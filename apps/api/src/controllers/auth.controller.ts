import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { authService } from '../services/auth.service';
import { config } from '../config';

export class AuthController {
  googleRedirect(req: Request, res: Response, next: NextFunction): void {
    if (!config.googleClientId || !config.googleClientSecret) {
      res.status(503).json({ success: false, error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
      return;
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  }

  googleCallback(req: Request, res: Response, next: NextFunction): void {
    if (!config.googleClientId || !config.googleClientSecret) {
      res.redirect(`${config.corsOrigin}/login?error=oauth_not_configured`);
      return;
    }
    passport.authenticate('google', {
      failureRedirect: `${config.corsOrigin}/login?error=oauth_failed`,
    })(req, res, () => {
      res.redirect(`${config.corsOrigin}/dashboard`);
    });
  }

  logout(req: Request, res: Response, next: NextFunction): void {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        res.json({ success: true, message: 'Logged out' });
      });
    });
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getCurrentUser((req.user as { id: string }).id);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
