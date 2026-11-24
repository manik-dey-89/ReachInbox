import type { Request, Response, NextFunction } from 'express';
import { recipientRepository } from '../repositories/recipient.repository';
import { campaignRepository } from '../repositories/campaign.repository';
import { ApiError } from '../middleware/errorHandler';
import { parseCSV, parseTXT, deduplicateRecipients } from '../utils/emailParser';

export class RecipientController {
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
      const result = await recipientRepository.findByCampaign(campaignId, page, pageSize);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async uploadRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const campaignId = req.params.id;

      const campaign = await campaignRepository.findById(campaignId);
      if (!campaign || campaign.userId !== userId) {
        throw new ApiError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
      }

      if (!req.file) {
        throw new ApiError(400, 'No file uploaded', 'NO_FILE');
      }

      const isCSV =
        req.file.mimetype === 'text/csv' ||
        req.file.mimetype === 'application/csv' ||
        req.file.originalname.endsWith('.csv');

      const rawRecipients = isCSV
        ? parseCSV(req.file.buffer)
        : parseTXT(req.file.buffer);

      const { valid, duplicates, invalid } = deduplicateRecipients(rawRecipients);

      const created = await recipientRepository.bulkCreate(
        valid.map((r) => ({ campaignId, email: r.email, name: r.name ?? null })),
      );

      res.json({
        success: true,
        data: {
          created,
          duplicatesSkipped: duplicates.length,
          invalidSkipped: invalid.length,
          duplicates,
          invalid,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const recipientController = new RecipientController();
