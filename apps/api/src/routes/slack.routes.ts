import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/status', (_req, res) => res.json({ success: true, data: { connected: false } }));

export default router;
