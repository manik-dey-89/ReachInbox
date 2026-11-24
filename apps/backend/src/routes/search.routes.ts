import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { searchController } from '../controllers/search.controller';

const router = Router();

router.use(requireAuth);

router.get('/emails', searchController.searchEmails.bind(searchController));

export default router;
