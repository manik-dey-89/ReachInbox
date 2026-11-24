import https from 'node:https';
import { prisma } from '../config/database';
import logger from '../utils/logger';

export class SlackService {
  async sendRateLimitNotification(userId: string, message: string): Promise<void> {
    try {
      const integration = await prisma.slackIntegration.findUnique({
        where: { userId },
      });

      if (!integration || integration.disconnectedAt !== null || !integration.webhookUrl) {
        // No active Slack integration — silently skip.
        return;
      }

      const body = JSON.stringify({ text: message });
      const webhookUrl = integration.webhookUrl;

      await new Promise<void>((resolve, reject) => {
        const url = new URL(webhookUrl);
        const options = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        };

        const req = https.request(options, (res) => {
          res.resume();
          res.on('end', resolve);
        });

        req.on('error', reject);
        req.write(body);
        req.end();
      });
    } catch (err) {
      logger.warn('Slack rate-limit notification failed — continuing silently', {
        userId,
        error: (err as Error).message,
      });
    }
  }
}

export const slackService = new SlackService();
