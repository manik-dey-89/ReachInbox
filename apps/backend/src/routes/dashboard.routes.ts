import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { campaignController } from '../controllers/campaign.controller';

const router = Router();

router.use(requireAuth);

router.get('/stats', campaignController.getStats.bind(campaignController));

export default router;
