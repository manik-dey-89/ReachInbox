import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { slackController } from '../controllers/slack.controller';

const router = Router();

// Connect initiates OAuth — user must be logged in
router.get('/connect', requireAuth, slackController.connect.bind(slackController));

// Callback from Slack (no requireAuth — Slack redirects here directly)
router.get('/callback', slackController.callback.bind(slackController));

// Status and disconnect require auth
router.get('/status', requireAuth, slackController.status.bind(slackController));
router.post('/disconnect', requireAuth, slackController.disconnect.bind(slackController));

export default router;
