import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { senderController } from '../controllers/sender.controller';

const router = Router();

router.use(requireAuth);

router.get('/', senderController.list.bind(senderController));
router.post('/', senderController.create.bind(senderController));
router.delete('/:id', senderController.delete.bind(senderController));

export default router;
