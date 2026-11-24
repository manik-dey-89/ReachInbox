import type { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { esClient } from '../config/elasticsearch';

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
}

export const healthController = new HealthController();
