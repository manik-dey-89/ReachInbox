import { prisma } from '../config/database';
import type { EmailRecipient } from '@reachinbox/shared';
import type { PaginatedResult } from './campaign.repository';

export interface CreateRecipientData {
  campaignId: string;
  email: string;
  name?: string | null;
  scheduledAt?: Date | null;
}

export class RecipientRepository {
  /**
   * Bulk-inserts recipients, skipping rows that violate the unique constraint
   * (campaignId, email). Returns the number of rows actually created.
   */
  async bulkCreate(recipients: CreateRecipientData[]): Promise<number> {
    const result = await prisma.emailRecipient.createMany({
      data: recipients,
      skipDuplicates: true,
    });
    return result.count;
  }

  async findByCampaign(
    campaignId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<EmailRecipient>> {
    const [items, total] = await Promise.all([
      prisma.emailRecipient.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.emailRecipient.count({ where: { campaignId } }),
    ]);

    return {
      items: items as unknown as EmailRecipient[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: Partial<EmailRecipient>,
  ): Promise<void> {
    // Strip any undefined values and known read-only fields before passing to Prisma
    const { id: _id, campaignId: _campaignId, createdAt: _createdAt, ...safeExtra } = (extra ?? {}) as Partial<EmailRecipient> & { id?: string; campaignId?: string; createdAt?: Date };
    await prisma.emailRecipient.update({
      where: { id },
      data: { status, ...safeExtra },
    });
  }

  async findPendingByCampaign(campaignId: string): Promise<EmailRecipient[]> {
    const rows = await prisma.emailRecipient.findMany({
      where: { campaignId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    return rows as unknown as EmailRecipient[];
  }
}

export const recipientRepository = new RecipientRepository();
