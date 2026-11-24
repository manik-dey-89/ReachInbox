import { prisma } from '../config/database';
import type { EmailDeliveryLog } from '@reachinbox/shared';
import type { PaginatedResult } from './campaign.repository';

export interface CreateDeliveryData {
  emailJobId: string;
  recipientId: string;
  campaignId: string;
  status: string;
  smtpMessageId?: string | null;
  smtpResponse?: string | null;
  sentAt?: Date | null;
}

export class DeliveryRepository {
  /**
   * Checks whether a successful delivery record already exists for this job.
   * Used for idempotency: if one exists the email was already sent.
   */
  async findSuccessfulDelivery(emailJobId: string): Promise<EmailDeliveryLog | null> {
    return prisma.emailDeliveryLog.findFirst({
      where: { emailJobId, status: 'SENT' },
    }) as unknown as EmailDeliveryLog | null;
  }

  async create(data: CreateDeliveryData): Promise<EmailDeliveryLog> {
    return prisma.emailDeliveryLog.create({ data }) as unknown as EmailDeliveryLog;
  }

  async findByCampaign(
    campaignId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<EmailDeliveryLog>> {
    const [items, total] = await Promise.all([
      prisma.emailDeliveryLog.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.emailDeliveryLog.count({ where: { campaignId } }),
    ]);

    return {
      items: items as unknown as EmailDeliveryLog[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const deliveryRepository = new DeliveryRepository();
