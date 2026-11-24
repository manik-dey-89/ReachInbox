import { prisma } from '../config/database';
import type { AuditAction, RecentActivityItem } from '@reachinbox/shared';
import logger from '../utils/logger';

export class AuditService {
  async log(
    userId: string | null,
    action: AuditAction,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: (metadata ?? null) as any,
        },
      });
    } catch (err) {
      // Audit failures must never crash the application
      logger.error('Failed to write audit log', {
        error: (err as Error).message,
        action,
        entityType,
        entityId,
      });
    }
  }

  async getRecent(userId: string, limit: number): Promise<RecentActivityItem[]> {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      type: log.action,
      message: `${log.action}${log.entityId ? ` (${log.entityId})` : ''}`,
      timestamp: log.createdAt,
      metadata: (log.metadata as Record<string, unknown>) ?? undefined,
    }));
  }
}

export const auditService = new AuditService();
