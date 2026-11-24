import { Queue } from 'bullmq';
import { createRedisClient } from './redis';
import type { EmailJobPayload } from '@reachinbox/shared';

// Create a dedicated Redis connection for BullMQ (required by BullMQ).
const queueConnection = createRedisClient();

const emailQueue = new Queue<EmailJobPayload>('email-queue', {
  connection: queueConnection,
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

export { emailQueue, queueConnection };
