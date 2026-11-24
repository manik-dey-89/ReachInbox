import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { emailService } from '../services/email.service';
import { auditService } from '../services/audit.service';
import { encryptPassword } from '../utils/crypto';
import { ApiError } from '../middleware/errorHandler';
import { AuditAction } from '@reachinbox/shared';

const createSenderSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  useEthereal: z.boolean().optional(),
});

export class SenderController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const parsed = createSenderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR');
      }

      const data = parsed.data;
      let smtpHost: string;
      let smtpPort: number;
      let smtpUser: string;
      let smtpPass: string;

      if (data.useEthereal) {
        const ethereal = await emailService.createEtherealAccount();
        smtpHost = ethereal.host;
        smtpPort = ethereal.port;
        smtpUser = ethereal.user;
        smtpPass = ethereal.pass;
      } else {
        if (!data.smtpHost || !data.smtpUser || !data.smtpPass) {
          throw new ApiError(
            400,
            'smtpHost, smtpUser, and smtpPass are required when useEthereal is false',
            'MISSING_SMTP_FIELDS',
          );
        }
        smtpHost = data.smtpHost;
        smtpPort = data.smtpPort ?? 587;
        smtpUser = data.smtpUser;
        smtpPass = data.smtpPass;
      }

      const sender = await prisma.senderAccount.create({
        data: {
          userId,
          name: data.name,
          email: data.email,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPassEncrypted: encryptPassword(smtpPass),
        },
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await auditService.log(
        userId,
        AuditAction.SENDER_CREATED,
        'SenderAccount',
        sender.id,
        { email: data.email, useEthereal: data.useEthereal ?? false },
      );

      res.status(201).json({ success: true, data: sender });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const senders = await prisma.senderAccount.findMany({
        where: { userId },
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: senders });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const sender = await prisma.senderAccount.findUnique({
        where: { id: req.params.id },
      });

      if (!sender || sender.userId !== userId) {
        throw new ApiError(404, 'Sender account not found', 'SENDER_NOT_FOUND');
      }

      await prisma.senderAccount.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: 'Sender account deleted' });
    } catch (err) {
      next(err);
    }
  }
}

export const senderController = new SenderController();
