import { Worker } from 'bullmq';
import { config } from './config';
import { createRedisClient, redis } from './config/redis';
import { prisma } from './config/database';
import { processEmailJob } from './processors/email.processor';
import logger from './utils/logger';

const worker = new Worker('email-queue', processEmailJob, {
  concurrency: config.workerConcurrency,
  connection: createRedisClient(),
});

worker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error('Job failed', { jobId: job?.id, error: err.message });
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

worker.on('stalled', (jobId) => {
  logger.warn('Job stalled', { jobId });
});

logger.info(`Worker started, concurrency: ${config.workerConcurrency}, queue: email-queue`);

async function shutdown(): Promise<void> {
  logger.info('Shutdown signal received — draining worker');
  try {
    await worker.close();
    await prisma.$disconnect();
    await redis.quit();
    logger.info('Worker shut down cleanly');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
