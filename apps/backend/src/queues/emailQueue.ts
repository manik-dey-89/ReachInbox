import { Queue } from 'bullmq';
import { createRedisClient } from '../config/redis';
import type { EmailJobPayload } from '@reachinbox/shared';

export const emailQueue = new Queue<EmailJobPayload>('email-queue', {
  connection: createRedisClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});
