import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/stats', (_req, res) => res.json({ success: true, data: {} }));

export default router;
