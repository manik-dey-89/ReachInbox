import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { campaignService } from '../services/campaign.service';
import { dashboardService } from '../services/dashboard.service';
import { ApiError } from '../middleware/errorHandler';

const createCampaignSchema = z.object({
  senderAccountId: z.string().min(1),
  subject: z.string().min(1).max(998),
  body: z.string().min(1),
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
      }),
    )
    .min(1),
  scheduledAt: z.string().min(1).refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid date/time' }),
  delayBetweenMs: z.number().int().min(0).default(1000),
  hourlyLimit: z.number().int().min(1).optional(),
});

export class CampaignController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const parsed = createCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR');
      }
      const campaign = await campaignService.createCampaign(userId, parsed.data);
      res.status(201).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const status = req.query.status as string | undefined;
      const result = await campaignService.listCampaigns(userId, page, pageSize, status);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const campaign = await campaignService.getCampaign(userId, req.params.id);
      res.json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }

  async schedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const result = await campaignService.scheduleCampaign(userId, req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      await campaignService.cancelCampaign(userId, req.params.id);
      res.json({ success: true, message: 'Campaign cancelled' });
    } catch (err) {
      next(err);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const stats = await dashboardService.getStats(userId);
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
}

export const campaignController = new CampaignController();
