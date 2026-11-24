import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { emailController } from '../controllers/email.controller';

const router = Router();

router.use(requireAuth);

router.get('/', emailController.list.bind(emailController));

export default router;
