import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

type EmailView = 'scheduled' | 'sent' | 'failed';

const VIEW_STATUS_MAP: Record<EmailView, string[]> = {
  scheduled: ['PENDING', 'PROCESSING', 'RATE_LIMITED', 'DELAYED'],
  sent: ['COMPLETED'],
  failed: ['FAILED'],
};

export class EmailController {
  /**
   * GET /api/emails
   * Returns individual EmailJob records (one row per recipient).
   *
   * Query params:
   *   view      – 'scheduled' | 'sent' | 'failed'  (default: 'scheduled')
   *   page      – 1-based page number               (default: 1)
   *   pageSize  – rows per page, max 100            (default: 20)
   *   q         – search string (recipient email or subject)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const view: EmailView = (req.query.view as EmailView) ?? 'scheduled';
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

      const statuses = VIEW_STATUS_MAP[view] ?? VIEW_STATUS_MAP.scheduled;

      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        campaign: { userId },
        status: { in: statuses },
      };

      if (q) {
        where.OR = [
          { recipient: { email: { contains: q, mode: 'insensitive' } } },
          { campaign: { subject: { contains: q, mode: 'insensitive' } } },
        ];
        // AND the user scope with the OR search
        delete where.campaign;
        where.AND = [
          { campaign: { userId } },
          { status: { in: statuses } },
          {
            OR: [
              { recipient: { email: { contains: q, mode: 'insensitive' } } },
              { campaign: { subject: { contains: q, mode: 'insensitive' } } },
            ],
          },
        ];
        delete where.status;
        delete where.OR;
      }

      const skip = (page - 1) * pageSize;

      const [jobs, total] = await Promise.all([
        prisma.emailJob.findMany({
          where,
          include: {
            recipient: { select: { email: true, name: true } },
            campaign: { select: { subject: true } },
            deliveryLogs: {
              select: { smtpResponse: true, sentAt: true, status: true },
              orderBy: { sentAt: 'desc' },
              take: 1,
            },
          },
          orderBy: view === 'sent'
            ? { processedAt: 'desc' }
            : { scheduledFor: 'asc' },
          skip,
          take: pageSize,
        }),
        prisma.emailJob.count({ where }),
      ]);

      const items = jobs.map((job) => {
        const latestLog = job.deliveryLogs?.[0];
        const previewUrl =
          latestLog?.smtpResponse?.startsWith('http')
            ? latestLog.smtpResponse
            : null;
        return {
          id: job.id,
          campaignId: job.campaignId,
          recipientEmail: job.recipient?.email ?? '',
          recipientName: job.recipient?.name ?? null,
          subject: job.campaign?.subject ?? '',
          status: job.status,
          scheduledFor: job.scheduledFor?.toISOString() ?? null,
          processedAt: job.processedAt?.toISOString() ?? null,
          sentAt: latestLog?.sentAt?.toISOString() ?? null,
          lastError: job.lastError ?? null,
          previewUrl,
        };
      });

      res.json({
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const emailController = new EmailController();
