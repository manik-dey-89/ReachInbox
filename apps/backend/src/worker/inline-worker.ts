import type { Worker } from 'bullmq';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * Starts an inline BullMQ Worker inside the backend process when
 * `ENABLE_INLINE_WORKER=true`. Returns the Worker instance (so graceful
 * shutdown can drain it) or `null` when the feature is disabled.
 *
 * The heavy modules (bullmq, the queue config, the email processor) are
 * loaded lazily via dynamic import so the disabled path stays cheap, and the
 * standalone `apps/worker` entry point remains the canonical way to run
 * processing on a paid plan.
 *
 * Duplicate-processing safety is provided by the email processor's
 * idempotency check (a committed SENT delivery log short-circuits a retry),
 * not by BullMQ alone.
 */
export async function startInlineWorker(): Promise<Worker | null> {
  if (process.env.ENABLE_INLINE_WORKER !== 'true') {
    logger.info('Inline worker disabled — set ENABLE_INLINE_WORKER=true to enable');
    return null;
  }

  const { Worker } = await import('bullmq');
  const { redisOptions } = await import('../config/queue');
  const { processEmailJob } = await import('./email.processor');

  const worker = new Worker('email-queue', processEmailJob, {
    concurrency: config.workerConcurrency,
    connection: { ...redisOptions },
  });

  worker.on('completed', (job) => {
    logger.info('Inline worker: job completed', { jobId: job.id });
  });
  worker.on('failed', (job, err) => {
    logger.error('Inline worker: job failed', { jobId: job?.id, error: err.message });
  });
  worker.on('error', (err) => {
    logger.error('Inline worker: error', { error: err.message });
  });
  worker.on('stalled', (jobId) => {
    logger.warn('Inline worker: job stalled', { jobId });
  });

  logger.info('Inline BullMQ worker started', {
    concurrency: config.workerConcurrency,
    queue: 'email-queue',
  });

  return worker;
}

/**
 * Gracefully closes the inline worker, waiting up to `drainTimeoutMs` for
 * in-flight jobs to finish before force-closing the connection. A no-op when
 * `worker` is null (feature disabled).
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
