import { Router } from 'express';
import passport from 'passport';
import { authRateLimiter } from '../middleware/rateLimiter';
import { config } from '../config';

const router = Router();

router.use(authRateLimiter);

// Initiates Google OAuth flow
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${config.corsOrigin}/login?error=oauth_failed`,
  }),
  (_req, res) => {
    res.redirect(`${config.corsOrigin}/dashboard`);
  },
);

// Logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.json({ success: true, message: 'Logged out' });
    });
  });
});

// Current user
router.get('/me', (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }
  res.json({ success: true, data: req.user });
});

export default router;
