import { prisma } from '../config/database';
import type { SlackIntegration } from '@reachinbox/shared';

export interface CreateSlackData {
  userId: string;
  teamId: string;
  teamName: string;
  botToken: string;
  webhookUrl?: string | null;
}

export class SlackRepository {
  async findByUserId(userId: string): Promise<SlackIntegration | null> {
    return prisma.slackIntegration.findUnique({
      where: { userId },
    }) as unknown as SlackIntegration | null;
  }

  async upsert(data: CreateSlackData): Promise<SlackIntegration> {
    return prisma.slackIntegration.upsert({
      where: { userId: data.userId },
      create: { ...data, webhookUrl: data.webhookUrl ?? null },
      update: {
        teamId: data.teamId,
        teamName: data.teamName,
        botToken: data.botToken,
        webhookUrl: data.webhookUrl ?? null,
        disconnectedAt: null,
      },
    }) as unknown as SlackIntegration;
  }

  async delete(userId: string): Promise<void> {
    await prisma.slackIntegration.update({
      where: { userId },
      data: { disconnectedAt: new Date() },
    });
  }

  async update(userId: string, data: Partial<SlackIntegration>): Promise<SlackIntegration> {
    // Strip immutable fields before update
    const { id: _id, userId: _userId, connectedAt: _connectedAt, ...updateData } = data as Partial<SlackIntegration> & { id?: string; userId?: string; connectedAt?: Date };
    return prisma.slackIntegration.update({
      where: { userId },
      data: updateData,
    }) as unknown as SlackIntegration;
  }
}

export const slackRepository = new SlackRepository();
