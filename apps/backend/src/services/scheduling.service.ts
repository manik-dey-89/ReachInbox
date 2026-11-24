import { emailQueue } from '../config/queue';
import { jobRepository } from '../repositories/job.repository';
import { prisma } from '../config/database';
import { generateIdempotencyKey } from '../utils/idempotency';
import logger from '../utils/logger';

export class SchedulingService {
  /**
   * Calculates the delay (in ms) for a job at the given index within a campaign.
   *
   * The strategy fits jobs into hourly rate-limit windows:
   * - Base delay is the time until the campaign's scheduledAt time.
   * - Each job is offset by its index multiplied by delayBetweenMs.
   * - When accumulated emails within the current window reach globalHourlyLimit,
   *   the remaining jobs are pushed into the next window.
   */
  calculateJobDelay(
    scheduledAt: Date,
    index: number,
    delayBetweenMs: number,
    globalHourlyLimit: number,
  ): number {
    const baseDelay = Math.max(0, scheduledAt.getTime() - Date.now());

    // Calculate which rate-limit window this job falls into
    const windowIndex = Math.floor(index / globalHourlyLimit);
    const windowOffset = windowIndex * 60 * 60 * 1000; // push by windowIndex hours

    return baseDelay + windowOffset + index * delayBetweenMs;
  }

  /**
   * Finds PENDING or PROCESSING jobs that have been stuck for more than 10 minutes
   * (indicating a crashed worker) and re-queues them in BullMQ.
   * Returns the number of jobs recovered.
   */
  async recoverInterruptedJobs(): Promise<number> {
    const stuckJobs = await jobRepository.findPendingByRecovery();
    let recovered = 0;

    for (const job of stuckJobs) {
      try {
        // Check whether the BullMQ job still exists
        const existing = await emailQueue.getJob(job.bullJobId);
        if (existing) {
          // Job is still in BullMQ — skip
          continue;
        }

        // Fetch the recipient and campaign to reconstruct the payload
        const recipient = await prisma.emailRecipient.findUnique({
          where: { id: job.recipientId },
          include: { campaign: true },
        });

        if (!recipient || !recipient.campaign) {
          logger.warn('Recovery: recipient or campaign missing', { jobId: job.id });
          continue;
        }

        const campaign = recipient.campaign;
        const delay = Math.max(0, job.scheduledFor.getTime() - Date.now());

        const bullJob = await emailQueue.add(
          'send-email',
          {
            jobId: job.id,
            recipientId: job.recipientId,
            campaignId: job.campaignId,
            userId: campaign.userId,
            senderAccountId: campaign.senderAccountId,
            recipientEmail: recipient.email,
            recipientName: recipient.name ?? null,
            subject: campaign.subject,
            body: campaign.body,
            attempt: job.attempt,
            idempotencyKey: generateIdempotencyKey(job.campaignId, job.recipientId),
          },
          { delay },
        );

        // Update DB record with new BullMQ job id and reset status
        await prisma.emailJob.update({
          where: { id: job.id },
          data: { bullJobId: bullJob.id, status: 'PENDING', updatedAt: new Date() },
        });

        recovered++;
        logger.info('Recovered interrupted job', {
          dbJobId: job.id,
          newBullJobId: bullJob.id,
        });
      } catch (err) {
        logger.error('Failed to recover job', {
          jobId: job.id,
          error: (err as Error).message,
        });
      }
    }

    return recovered;
  }
}

export const schedulingService = new SchedulingService();
