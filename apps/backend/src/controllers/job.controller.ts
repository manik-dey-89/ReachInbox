import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { campaignRepository } from '../repositories/campaign.repository';
import { rateLimitService } from '../services/rateLimit.service';
import { emailQueue } from '../config/queue';
import { ApiError } from '../middleware/errorHandler';
import type { PaginatedResponse } from '../shared-index';

export class JobController {
  async listByCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const campaignId = req.params.id;

      const campaign = await campaignRepository.findById(campaignId);
      if (!campaign || campaign.userId !== userId) {
        throw new ApiError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const skip = (page - 1) * pageSize;

      const [items, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: { campaignId },
          orderBy: { scheduledFor: 'asc' },
          skip,
          take: pageSize,
        }),
        prisma.emailJob.count({ where: { campaignId } }),
      ]);

      const result: PaginatedResponse<typeof items[0]> = {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/jobs?status=FAILED&page=1&pageSize=20
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const status = req.query.status as string | undefined;
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const skip = (page - 1) * pageSize;

      // Only return jobs belonging to this user's campaigns
      const where = {
        campaign: { userId },
        ...(status ? { status } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.emailJob.findMany({
          where,
          include: {
            recipient: { select: { email: true, name: true } },
            campaign: { select: { subject: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.emailJob.count({ where }),
      ]);

      const result: PaginatedResponse<typeof items[0]> = {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/jobs/:id/retry
  async retry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const jobId = req.params.id;

      const job = await prisma.emailJob.findUnique({
        where: { id: jobId },
        include: {
          campaign: { select: { userId: true, subject: true, body: true, senderAccountId: true } },
          recipient: { select: { email: true, name: true } },
        },
      });

      if (!job || job.campaign.userId !== userId) {
        throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
      }

      const payload = {
        jobId: job.id,
        recipientId: job.recipientId,
        campaignId: job.campaignId,
        userId,
        senderAccountId: job.campaign.senderAccountId,
        recipientEmail: job.recipient.email,
        recipientName: job.recipient.name,
        subject: job.campaign.subject,
        body: job.campaign.body,
        attempt: (job.attempt ?? 0) + 1,
        idempotencyKey: `retry:${job.id}:${Date.now()}`,
      };

      await emailQueue.add('send-email', payload, {
        jobId: `retry:${job.id}:${Date.now()}`,
      });

      await prisma.emailJob.update({
        where: { id: jobId },
        data: { status: 'PENDING', lastError: null },
      });

      res.json({ success: true, message: 'Job re-queued' });
    } catch (err) {
      next(err);
    }
  }

  async getRateLimitStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;

      const senders = await prisma.senderAccount.findMany({
        where: { userId },
        select: { id: true },
      });

      const senderIds = senders.map((s) => s.id);
      const status = await rateLimitService.getStatus(userId, senderIds);

      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }
}

export const jobController = new JobController();
