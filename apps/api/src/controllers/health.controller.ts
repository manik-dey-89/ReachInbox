import type { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { esClient } from '../config/elasticsearch';
import { emailQueue } from '../config/queue';

export class HealthController {
  async check(_req: Request, res: Response): Promise<void> {
    const services: Record<string, string> = {};

    await Promise.all([
      prisma.$queryRaw`SELECT 1`
        .then(() => { services.database = 'ok'; })
        .catch(() => { services.database = 'error'; }),

      redis.ping()
        .then(() => { services.redis = 'ok'; })
        .catch(() => { services.redis = 'error'; }),

      esClient.ping()
        .then(() => { services.elasticsearch = 'ok'; })
        .catch(() => { services.elasticsearch = 'degraded'; }),
    ]);

    const hasError = Object.values(services).includes('error');
    const status = hasError ? 'degraded' : 'ok';

    res.status(hasError ? 503 : 200).json({
      status,
      services,
      timestamp: new Date().toISOString(),
    });
  }

  async queues(_req: Request, res: Response): Promise<void> {
    try {
      const counts = await emailQueue.getJobCounts(
        'waiting', 'active', 'delayed', 'completed', 'failed', 'paused'
      );
      res.json({ success: true, data: counts });
    } catch (err) {
      res.status(503).json({ success: false, error: 'Could not fetch queue stats', data: { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0, paused: 0 } });
    }
  }
}

export const healthController = new HealthController();
