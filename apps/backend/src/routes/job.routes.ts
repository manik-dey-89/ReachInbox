import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { jobController } from '../controllers/job.controller';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// Global job list — GET /api/jobs?status=FAILED&page=1
router.get('/', jobController.listAll.bind(jobController));

// Retry a specific job — POST /api/jobs/:id/retry
router.post('/:id/retry', jobController.retry.bind(jobController));

// List jobs for a campaign — also mounted at /api/campaigns/:id/jobs
router.get('/campaign/:campaignId', jobController.listByCampaign.bind(jobController));

export default router;
