import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(authRateLimiter);

// Initiates Google OAuth flow
router.get('/google', authController.googleRedirect.bind(authController));

// Google OAuth callback
router.get('/google/callback', authController.googleCallback.bind(authController));

// Logout
router.post('/logout', authController.logout.bind(authController));

// Current user
router.get('/me', requireAuth, authController.me.bind(authController));

export default router;
