import https from 'node:https';
import { config } from '../config';
import { slackRepository } from '../repositories/slack.repository';
import type { SlackIntegration } from '@reachinbox/shared';
import logger from '../utils/logger';

export interface SlackTokenResponse {
  access_token: string;
  team: { id: string; name: string };
  incoming_webhook?: { url: string };
}

/** Makes a simple HTTPS POST with an application/x-www-form-urlencoded body. */
function httpsPost(url: string, body: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export class SlackService {
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.slackClientId,
      scope: 'incoming-webhook',
      redirect_uri: config.slackRedirectUri,
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<SlackTokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: config.slackClientId,
      client_secret: config.slackClientSecret,
      redirect_uri: config.slackRedirectUri,
    }).toString();

    const data = (await httpsPost('https://slack.com/api/oauth.v2.access', body)) as SlackTokenResponse & {
      ok: boolean;
      error?: string;
    };

    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error ?? 'unknown'}`);
    }

    return data;
  }

  async saveIntegration(userId: string, data: SlackTokenResponse): Promise<SlackIntegration> {
    return slackRepository.upsert({
      userId,
      teamId: data.team.id,
      teamName: data.team.name,
      botToken: data.access_token,
      webhookUrl: data.incoming_webhook?.url ?? null,
    });
  }

  async getStatus(
    userId: string,
  ): Promise<{ connected: boolean; integration?: { id: string; teamId: string; teamName: string; connectedAt: Date } | null }> {
    const integration = await slackRepository.findByUserId(userId);
    if (!integration || integration.disconnectedAt !== null) {
      return { connected: false, integration: null };
    }
    return {
      connected: true,
      integration: {
        id: integration.id,
        teamId: integration.teamId,
        teamName: integration.teamName,
        connectedAt: integration.connectedAt,
      },
    };
  }

  async disconnect(userId: string): Promise<void> {
    const integration = await slackRepository.findByUserId(userId);
    if (!integration || integration.disconnectedAt !== null) return;

    // Attempt to revoke the token with Slack
    try {
      const body = new URLSearchParams({ token: integration.botToken }).toString();
      await httpsPost('https://slack.com/api/auth.revoke', body);
    } catch (err) {
      logger.warn('Failed to revoke Slack token', { error: (err as Error).message });
    }

    await slackRepository.delete(userId);
  }

  async sendRateLimitNotification(userId: string, message: string): Promise<void> {
    try {
      const integration = await slackRepository.findByUserId(userId);
      if (!integration || integration.disconnectedAt !== null || !integration.webhookUrl) {
        return;
      }

      const body = JSON.stringify({ text: message });
      await new Promise<void>((resolve, reject) => {
        const url = new URL(integration.webhookUrl!);
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
      logger.warn('Slack notification failed — continuing silently', {
        userId,
        error: (err as Error).message,
      });
    }
  }
}

export const slackService = new SlackService();
