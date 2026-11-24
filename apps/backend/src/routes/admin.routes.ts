import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from '../config/queue';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter,
});

router.use(requireAuth, requireAdmin, serverAdapter.getRouter());

export default router;
