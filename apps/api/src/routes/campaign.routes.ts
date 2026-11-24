import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// Placeholder — controllers implemented in Phase 4
router.get('/', (_req, res) => res.json({ success: true, data: [] }));

export default router;
