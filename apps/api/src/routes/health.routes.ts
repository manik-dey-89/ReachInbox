import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /health — service health check (no auth)
router.get('/', healthController.check.bind(healthController));

// GET /health/queues — queue stats for monitoring page (no auth needed for stats)
router.get('/queues', healthController.queues.bind(healthController));

// DELETE /health/queues/:state — drain jobs by state (requires auth)
router.delete('/queues/:state', requireAuth, healthController.drainQueue.bind(healthController));

export default router;
