import { prisma } from '../config/database';
import type { EmailCampaign, DashboardStats } from '@reachinbox/shared';

export interface CreateCampaignData {
  userId: string;
  senderAccountId: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  delayBetweenMs: number;
  hourlyLimit?: number;
  totalRecipients?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class CampaignRepository {
  async create(data: CreateCampaignData): Promise<EmailCampaign> {
    return prisma.emailCampaign.create({ data }) as unknown as EmailCampaign;
  }

  async findById(id: string): Promise<EmailCampaign | null> {
    return prisma.emailCampaign.findUnique({ where: { id } }) as unknown as EmailCampaign | null;
  }

  async findByUserId(
    userId: string,
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<PaginatedResult<EmailCampaign>> {
    const where = {
      userId,
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          deliveryLogs: {
            where: { status: 'SENT' },
            select: {
              id: true,
              smtpResponse: true,
              smtpMessageId: true,
              sentAt: true,
              recipientId: true,
            },
            orderBy: { sentAt: 'asc' },
          },
          recipients: {
            select: {
              id: true,
              email: true,
              name: true,
              status: true,
            },
            take: 5,
          },
        },
      }),
      prisma.emailCampaign.count({ where }),
    ]);

    return {
      items: items as unknown as EmailCampaign[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateStatus(id: string, status: string): Promise<EmailCampaign> {
    return prisma.emailCampaign.update({
      where: { id },
      data: { status },
    }) as unknown as EmailCampaign;
  }

  async updateCounts(id: string, sentIncrement: number, failedIncrement: number): Promise<void> {
    await prisma.emailCampaign.update({
      where: { id },
      data: {
        sentCount: { increment: sentIncrement },
        failedCount: { increment: failedIncrement },
      },
    });
  }

  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const [campaigns, senderAccounts] = await Promise.all([
      prisma.emailCampaign.findMany({
        where: { userId },
        select: {
          id: true,
          status: true,
          sentCount: true,
          failedCount: true,
          totalRecipients: true,
          senderAccountId: true,
        },
      }),
      prisma.senderAccount.findMany({
        where: { userId },
        select: { id: true, name: true, email: true },
      }),
    ]);

    const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
    const totalFailed = campaigns.reduce((sum, c) => sum + c.failedCount, 0);
    const totalScheduled = campaigns.reduce((sum, c) => sum + c.totalRecipients, 0);
    const totalPending = campaigns
      .filter((c) => ['SCHEDULED', 'SENDING', 'DRAFT'].includes(c.status))
      .reduce((sum, c) => sum + (c.totalRecipients - c.sentCount - c.failedCount), 0);

    const senderStats = senderAccounts.map((sender) => {
      const senderCampaigns = campaigns.filter((c) => c.senderAccountId === sender.id);
      return {
        senderId: sender.id,
        senderName: sender.name,
        senderEmail: sender.email,
        sent: senderCampaigns.reduce((sum, c) => sum + c.sentCount, 0),
        failed: senderCampaigns.reduce((sum, c) => sum + c.failedCount, 0),
        pending: senderCampaigns
          .filter((c) => ['SCHEDULED', 'SENDING', 'DRAFT'].includes(c.status))
          .reduce((sum, c) => sum + (c.totalRecipients - c.sentCount - c.failedCount), 0),
        hourlyUsage: 0,
        hourlyLimit: Number(process.env.SENDER_HOURLY_LIMIT ?? 50),
      };
    });

    // Recent activity from audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentActivity = auditLogs.map((log) => ({
      id: log.id,
      type: log.action,
      message: `${log.action}${log.entityId ? ` (${log.entityId})` : ''}`,
      timestamp: log.createdAt,
      metadata: (log.metadata as Record<string, unknown>) ?? undefined,
    }));

    return {
      totalScheduled,
      totalSent,
      totalFailed,
      totalPending: Math.max(0, totalPending),
      hourlyUsage: { global: 0, limit: Number(process.env.GLOBAL_HOURLY_LIMIT ?? 100) },
      recentActivity,
      senderStats,
    };
  }
}

export const campaignRepository = new CampaignRepository();
