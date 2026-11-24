import { prisma } from '../config/database';
import type { EmailJob } from '@reachinbox/shared';

export interface CreateJobData {
  recipientId: string;
  campaignId: string;
  bullJobId: string;
  scheduledFor: Date;
  status?: string;
}

export class JobRepository {
  async create(data: CreateJobData): Promise<EmailJob> {
    return prisma.emailJob.create({ data }) as unknown as EmailJob;
  }

  async findByBullJobId(bullJobId: string): Promise<EmailJob | null> {
    return prisma.emailJob.findUnique({ where: { bullJobId } }) as unknown as EmailJob | null;
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: Partial<EmailJob>,
  ): Promise<void> {
    const { id: _id, recipientId: _r, campaignId: _c, bullJobId: _b, createdAt: _ca, updatedAt: _ua, ...safeExtra } =
      (extra ?? {}) as Partial<EmailJob> & {
        id?: string; recipientId?: string; campaignId?: string; bullJobId?: string;
        createdAt?: Date; updatedAt?: Date;
      };
    await prisma.emailJob.update({
      where: { id },
      data: { status, ...safeExtra },
    });
  }

  /**
   * Finds jobs stuck in PENDING or PROCESSING state for more than 10 minutes,
   * which signals an interrupted worker that never updated the record.
   */
  async findPendingByRecovery(): Promise<EmailJob[]> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const rows = await prisma.emailJob.findMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        updatedAt: { lt: tenMinutesAgo },
      },
      orderBy: { scheduledFor: 'asc' },
    });
    return rows as unknown as EmailJob[];
  }
}

export const jobRepository = new JobRepository();
