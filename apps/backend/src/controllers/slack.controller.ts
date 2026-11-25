import type { Request, Response, NextFunction } from 'express';
import { slackService } from '../services/slack.service';
import { auditService } from '../services/audit.service';
import { ApiError } from '../middleware/errorHandler';
import { AuditAction } from '../shared-index';
import { config } from '../config';
import crypto from 'crypto';

export class SlackController {
  connect(req: Request, res: Response, next: NextFunction): void {
    try {
      const userId = (req.user as { id: string }).id;
      // Use a random state token that includes the userId for validation
      const state = `${userId}:${crypto.randomBytes(16).toString('hex')}`;
      const authUrl = slackService.getAuthUrl(state);
      res.redirect(authUrl);
    } catch (err) {
      next(err);
    }
  }

  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error } = req.query as Record<string, string>;

      if (error) {
        return res.redirect(`${config.corsOrigin}/slack?error=${encodeURIComponent(error)}`) as unknown as void;
      }

      if (!code) {
        return res.redirect(`${config.corsOrigin}/slack?error=missing_code`) as unknown as void;
      }

      // Extract userId from state
      const userId = state?.split(':')[0];
      if (!userId) {
        return res.redirect(`${config.corsOrigin}/slack?error=invalid_state`) as unknown as void;
      }

      const tokenData = await slackService.exchangeCode(code);
      await slackService.saveIntegration(userId, tokenData);

      await auditService.log(
        userId,
        AuditAction.SLACK_CONNECTED,
        'SlackIntegration',
        undefined,
        { teamName: tokenData.team.name },
      );

      res.redirect(`${config.corsOrigin}/slack?connected=true`);
    } catch (err) {
      // Redirect to frontend with error rather than showing raw JSON
      const message = encodeURIComponent((err as Error).message ?? 'oauth_failed');
      res.redirect(`${config.corsOrigin}/slack?error=${message}`);
    }
  }

  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      const status = await slackService.getStatus(userId);
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id: string }).id;
      await slackService.disconnect(userId);

      await auditService.log(userId, AuditAction.SLACK_DISCONNECTED, 'SlackIntegration');

      res.json({ success: true, message: 'Slack disconnected' });
    } catch (err) {
      next(err);
    }
  }
}

export const slackController = new SlackController();
