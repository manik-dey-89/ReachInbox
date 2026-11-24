import { prisma } from '../config/database';
import type { AuditAction } from '@reachinbox/shared';
import logger from '../utils/logger';

interface AuditLogParams {
  userId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class AuditService {
  async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId ?? null,
          action: params.action,
          entityType: params.entityType ?? null,
          entityId: params.entityId ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: (params.metadata ?? null) as any,
        },
      });
    } catch (err) {
      // Audit failures must never crash the application
      logger.error('Failed to write audit log', { error: (err as Error).message, params });
    }
  }
}

export const auditService = new AuditService();
