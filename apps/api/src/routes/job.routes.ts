import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { jobController } from '../controllers/job.controller';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// List jobs for a campaign — mounted at /api/campaigns/:id/jobs
router.get('/', jobController.listByCampaign.bind(jobController));

export default router;
