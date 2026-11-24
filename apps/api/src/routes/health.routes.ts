import { Router } from 'express';
import { healthController } from '../controllers/health.controller';

const router = Router();

// GET /health
router.get('/', healthController.check.bind(healthController));

// GET /health/queues — queue stats for monitoring page
router.get('/queues', healthController.queues.bind(healthController));

export default router;
