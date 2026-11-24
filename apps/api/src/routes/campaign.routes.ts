import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { campaignController } from '../controllers/campaign.controller';

const router = Router();

router.use(requireAuth);

// Dashboard stats (placed before /:id to avoid route conflict)
router.get('/dashboard/stats', campaignController.getStats.bind(campaignController));

// CRUD
router.get('/', campaignController.list.bind(campaignController));
router.post('/', campaignController.create.bind(campaignController));
router.get('/:id', campaignController.get.bind(campaignController));
router.delete('/:id', campaignController.cancel.bind(campaignController));

// Scheduling
router.post('/:id/schedule', campaignController.schedule.bind(campaignController));

export default router;
