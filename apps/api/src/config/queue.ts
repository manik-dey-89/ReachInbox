import { Queue } from 'bullmq';
import { config } from './index';
import type { EmailJobPayload } from '@reachinbox/shared';

// BullMQ manages its own Redis connection internally when given connection options.
// Passing a plain options object (not an ioredis instance) avoids lazyConnect issues.
const redisOptions = {
  host: new URL(config.redisUrl).hostname,
  port: Number(new URL(config.redisUrl).port) || 6379,
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
};

const emailQueue = new Queue<EmailJobPayload>('email-queue', {
  connection: redisOptions,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: Number(process.env.WORKER_MAX_RETRIES ?? 3),
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export { emailQueue, redisOptions };
