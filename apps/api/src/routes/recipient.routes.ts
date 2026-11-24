import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { recipientController } from '../controllers/recipient.controller';
import { uploadRecipients } from '../middleware/uploadHandler';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// List recipients for a campaign
// Mounted at /api/campaigns/:id/recipients — :id is the campaign id via mergeParams
router.get('/', recipientController.listByCampaign.bind(recipientController));

// Upload recipients via CSV or TXT
router.post('/upload', uploadRecipients, recipientController.uploadRecipients.bind(recipientController));

export default router;
