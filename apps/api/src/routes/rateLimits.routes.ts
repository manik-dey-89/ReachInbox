import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { jobController } from '../controllers/job.controller';

const router = Router();

router.use(requireAuth);

router.get('/status', jobController.getRateLimitStatus.bind(jobController));

export default router;
