import type { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { esClient } from '../config/elasticsearch';
import { emailQueue } from '../config/queue';

type DeletableState = 'completed' | 'failed' | 'wait' | 'delayed' | 'paused';

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
      res.status(503).json({
        success: false,
        error: 'Could not fetch queue stats',
        data: { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0, paused: 0 },
      });
    }
  }

  // DELETE /api/health/queues/:state — drain all jobs in a given state
  async drainQueue(req: Request, res: Response): Promise<void> {
    const { state } = req.params as { state: DeletableState };

    const allowed: DeletableState[] = ['completed', 'failed', 'wait', 'delayed', 'paused'];
    if (!allowed.includes(state)) {
      res.status(400).json({ success: false, error: `Invalid state. Must be one of: ${allowed.join(', ')}` });
      return;
    }

    try {
      let deleted = 0;

      if (state === 'completed') {
        await emailQueue.clean(0, 100_000, 'completed');
        // Also get remaining count
        const jobs = await emailQueue.getJobs(['completed'], 0, 10000);
        deleted = jobs.length;
        await Promise.all(jobs.map((j) => j.remove()));
      } else if (state === 'failed') {
        const jobs = await emailQueue.getJobs(['failed'], 0, 10000);
        deleted = jobs.length;
        await Promise.all(jobs.map((j) => j.remove()));
      } else if (state === 'wait') {
        const jobs = await emailQueue.getJobs(['waiting'], 0, 10000);
        deleted = jobs.length;
        await Promise.all(jobs.map((j) => j.remove()));
      } else if (state === 'delayed') {
        const jobs = await emailQueue.getJobs(['delayed'], 0, 10000);
        deleted = jobs.length;
        await Promise.all(jobs.map((j) => j.remove()));
      } else if (state === 'paused') {
        const jobs = await emailQueue.getJobs(['paused'], 0, 10000);
        deleted = jobs.length;
        await Promise.all(jobs.map((j) => j.remove()));
      }

      // Refresh counts after deletion
      const counts = await emailQueue.getJobCounts(
        'waiting', 'active', 'delayed', 'completed', 'failed', 'paused'
      );

      res.json({
        success: true,
        message: `Deleted ${deleted} ${state} job(s)`,
        data: counts,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }
}

export const healthController = new HealthController();
