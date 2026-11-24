import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', (_req, res) => res.json({ success: true, data: { hits: [], total: 0 } }));

export default router;
