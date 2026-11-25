import type { Worker } from 'bullmq';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * Starts an inline BullMQ Worker inside the backend process when
 * `ENABLE_INLINE_WORKER=true`. Returns the Worker instance (so graceful
 * shutdown can drain it) or `null` when the feature is disabled.
 */
export async function startInlineWorker(): Promise<Worker | null> {
  if (process.env.ENABLE_INLINE_WORKER !== 'true') {
    logger.info('Inline worker disabled — set ENABLE_INLINE_WORKER=true to enable');
    return null;
  }

  const { Worker } = await import('bullmq');
  const { redisOptions } = await import('../config/queue');
  const { processEmailJob } = await import('./email.processor');

  // On startup, reset any jobs that are stuck in PROCESSING state from a
  // previous crashed process. This prevents them staying PROCESSING forever.
  await resetStalledJobs();

  const worker = new Worker('email-queue', processEmailJob, {
    concurrency: config.workerConcurrency,
    connection: { ...redisOptions },
    // BullMQ stall detection: check for stalled jobs every 30s
    // A job is considered stalled if the worker hasn't sent a heartbeat
    // within stalledInterval ms. BullMQ will re-queue it automatically.
    stalledInterval: 30_000,
    // Lock duration: how long a job is locked to this worker instance.
    // Must be longer than your longest email send (20s timeout + buffer).
    lockDuration: 60_000,
  });

  worker.on('completed', (job) => {
    logger.info('Inline worker: job completed', { jobId: job.id });
  });
  worker.on('failed', (job, err) => {
    logger.error('Inline worker: job failed', { jobId: job?.id, error: err.message });
  });
  worker.on('error', (err) => {
    // Worker-level errors (connection issues etc.) — log but do NOT crash the process
    logger.error('Inline worker: connection/worker error', { error: err.message });
  });
  worker.on('stalled', (jobId) => {
    logger.warn('Inline worker: job stalled — will be re-queued by BullMQ', { jobId });
  });

  logger.info('Inline BullMQ worker started', {
    concurrency: config.workerConcurrency,
    queue: 'email-queue',
    stalledInterval: 30_000,
    lockDuration: 60_000,
  });

  return worker;
}

/**
 * Reset EmailJob records stuck in PROCESSING status from a previous
 * crashed worker. BullMQ's stall detection handles the queue side;
 * this handles the DB side so the frontend shows the correct status.
 *
 * Jobs that have been PROCESSING for more than 5 minutes are considered
 * stalled and are reset to PENDING so they can be retried.
 */
async function resetStalledJobs(): Promise<void> {
  try {
    const { prisma } = await import('../config/database');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const updated = await prisma.emailJob.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: fiveMinutesAgo },
      },
      data: { status: 'PENDING' },
    });

    if (updated.count > 0) {
      logger.info(`Reset ${updated.count} stalled PROCESSING jobs to PENDING on startup`);
    }
  } catch (err) {
    // Non-fatal — log and continue
    logger.warn('Could not reset stalled jobs on startup', { error: (err as Error).message });
  }
}

/**
 * Gracefully closes the inline worker, waiting up to `drainTimeoutMs` for
 * in-flight jobs to finish before force-closing. A no-op when worker is null.
 */
export async function closeInlineWorker(
  worker: Worker | null,
  drainTimeoutMs = 10_000,
): Promise<void> {
  if (!worker) {
    return;
  }

  try {
    await Promise.race([
      worker.close(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Worker drain timeout')), drainTimeoutMs),
      ),
    ]);
    logger.info('Inline worker closed');
  } catch (err) {
    logger.warn('Inline worker close timed out — forcing', { error: (err as Error).message });
    await worker.close(true);
  }
}
