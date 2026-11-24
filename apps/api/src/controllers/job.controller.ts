import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { campaignRepository } from '../repositories/campaign.repository';
import { rateLimitService } from '../services/rateLimit.service';
import { ApiError } from '../middleware/errorHandler';
import type { PaginatedResponse } from '@reachinbox/shared';

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
