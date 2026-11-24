import { prisma } from '../config/database';
import { campaignRepository } from '../repositories/campaign.repository';
import { recipientRepository } from '../repositories/recipient.repository';
import { jobRepository } from '../repositories/job.repository';
import { emailQueue } from '../config/queue';
import { auditService } from './audit.service';
import { ApiError } from '../middleware/errorHandler';
import type { EmailCampaign, CreateCampaignRequest, PaginatedResponse } from '@reachinbox/shared';
import { AuditAction } from '@reachinbox/shared';
import { generateIdempotencyKey } from '../utils/idempotency';
import logger from '../utils/logger';

export class CampaignService {
  async createCampaign(
    userId: string,
    data: CreateCampaignRequest,
  ): Promise<EmailCampaign> {
    // Verify sender belongs to user
    const sender = await prisma.senderAccount.findUnique({
      where: { id: data.senderAccountId },
    });
    if (!sender || sender.userId !== userId) {
      throw new ApiError(404, 'Sender account not found', 'SENDER_NOT_FOUND');
    }

    const campaign = await campaignRepository.create({
      userId,
      senderAccountId: data.senderAccountId,
      subject: data.subject,
      body: data.body,
      scheduledAt: new Date(data.scheduledAt),
      delayBetweenMs: data.delayBetweenMs,
      hourlyLimit: data.hourlyLimit,
      totalRecipients: data.recipients.length,
    });

    if (data.recipients.length > 0) {
      await recipientRepository.bulkCreate(
        data.recipients.map((r) => ({
          campaignId: campaign.id,
          email: r.email,
          name: r.name ?? null,
        })),
      );
    }

    await auditService.log(
      userId,
      AuditAction.CAMPAIGN_CREATED,
      'EmailCampaign',
      campaign.id,
      { subject: data.subject, recipientCount: data.recipients.length },
    );

    return campaign;
  }

  async scheduleCampaign(
    userId: string,
    campaignId: string,
  ): Promise<{ jobsScheduled: number }> {
    const campaign = await campaignRepository.findById(campaignId);
    if (!campaign || campaign.userId !== userId) {
      throw new ApiError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
    }

    const recipients = await recipientRepository.findPendingByCampaign(campaignId);
    if (recipients.length === 0) {
      throw new ApiError(400, 'No pending recipients to schedule', 'NO_PENDING_RECIPIENTS');
    }

    // Fetch the sender account (with encrypted password) for the payload
    const senderAccount = await prisma.senderAccount.findUnique({
      where: { id: campaign.senderAccountId },
    });
    if (!senderAccount) {
      throw new ApiError(404, 'Sender account not found', 'SENDER_NOT_FOUND');
    }

    // Fetch the raw Prisma record to access fields not in the shared EmailCampaign type
    const rawCampaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });

    const scheduledAt = campaign.scheduledAt instanceof Date
      ? campaign.scheduledAt.getTime()
      : new Date(campaign.scheduledAt as unknown as string).getTime();

    const delayBetweenMs = rawCampaign?.delayBetweenMs ?? 1000;
    let jobsScheduled = 0;

    for (let index = 0; index < recipients.length; index++) {
      const recipient = recipients[index];
      const delay = Math.max(0, scheduledAt - Date.now()) + index * delayBetweenMs;
      const scheduledFor = new Date(Date.now() + delay);

      const idempotencyKey = generateIdempotencyKey(campaignId, recipient.id);

      const bullJob = await emailQueue.add(
        'send-email',
        {
          jobId: '', // filled after DB record creation
          recipientId: recipient.id,
          campaignId,
          userId,
          senderAccountId: campaign.senderAccountId,
          recipientEmail: recipient.email,
          recipientName: recipient.name ?? null,
          subject: campaign.subject,
          body: campaign.body,
          attempt: 0,
          idempotencyKey,
        },
        { delay },
      );

      try {
        const dbJob = await jobRepository.create({
          recipientId: recipient.id,
          campaignId,
          bullJobId: bullJob.id ?? String(bullJob.token),
          scheduledFor,
        });

        // Update the BullMQ job data with the DB job id
        await bullJob.updateData({
          jobId: dbJob.id,
          recipientId: recipient.id,
          campaignId,
          userId,
          senderAccountId: campaign.senderAccountId,
          recipientEmail: recipient.email,
          recipientName: recipient.name ?? null,
          subject: campaign.subject,
          body: campaign.body,
          attempt: 0,
          idempotencyKey,
        });

        jobsScheduled++;
      } catch (err) {
        logger.error('Failed to create DB job record', {
          bullJobId: bullJob.id,
          recipientId: recipient.id,
          error: (err as Error).message,
        });
      }
    }

    await campaignRepository.updateStatus(campaignId, 'SCHEDULED');

    await auditService.log(
      userId,
      AuditAction.CAMPAIGN_SCHEDULED,
      'EmailCampaign',
      campaignId,
      { jobsScheduled },
    );

    return { jobsScheduled };
  }

  async getCampaign(userId: string, campaignId: string): Promise<EmailCampaign> {
    const campaign = await campaignRepository.findById(campaignId);
    if (!campaign || campaign.userId !== userId) {
      throw new ApiError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
    }
    return campaign;
  }

  async listCampaigns(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResponse<EmailCampaign>> {
    return campaignRepository.findByUserId(userId, page, pageSize);
  }

  async cancelCampaign(userId: string, campaignId: string): Promise<void> {
    const campaign = await campaignRepository.findById(campaignId);
    if (!campaign || campaign.userId !== userId) {
      throw new ApiError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
    }

    // Find all BullMQ job ids for this campaign
    const jobs = await prisma.emailJob.findMany({
      where: { campaignId, status: { in: ['PENDING', 'RATE_LIMITED'] } },
      select: { bullJobId: true, id: true },
    });

    // Remove BullMQ jobs
    await Promise.allSettled(
      jobs.map(async (j) => {
        const bullJob = await emailQueue.getJob(j.bullJobId);
        if (bullJob) {
          await bullJob.remove();
        }
      }),
    );

    // Mark DB jobs as cancelled
    if (jobs.length > 0) {
      await prisma.emailJob.updateMany({
        where: { id: { in: jobs.map((j) => j.id) } },
        data: { status: 'CANCELLED' },
      });
    }

    await campaignRepository.updateStatus(campaignId, 'CANCELLED');

    await auditService.log(
      userId,
      AuditAction.CAMPAIGN_CANCELLED,
      'EmailCampaign',
      campaignId,
    );
  }
}

export const campaignService = new CampaignService();
