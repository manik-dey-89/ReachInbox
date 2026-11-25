import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import https from 'node:https';
import { decryptPassword } from '../utils/crypto';
import type { SenderAccount } from '../shared-index';
import logger from '../utils/logger';

export interface SenderAccountWithPass extends SenderAccount {
  smtpPassEncrypted: string;
}

/**
 * Send via Resend HTTP API (port 443 — works on Render free tier).
 * Used as a fallback when Ethereal SMTP is blocked.
 * Requires RESEND_API_KEY env var.
 */
async function sendViaResend(params: {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string; previewUrl: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set. Add it in Render environment variables. Get a free key at resend.com');
  }

  const body = JSON.stringify({
    from: `${params.fromName} <${params.fromEmail}>`,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as { id?: string; name?: string; message?: string };
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Resend API error ${res.statusCode}: ${parsed.message ?? data}`));
            } else {
              resolve({ messageId: parsed.id ?? 'resend-unknown', previewUrl: null });
            }
          } catch {
            reject(new Error(`Resend API parse error: ${data}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export class EmailService {
  createTransporter(senderAccount: SenderAccountWithPass): Transporter {
    const pass = decryptPassword(senderAccount.smtpPassEncrypted);
    return nodemailer.createTransport({
      host: senderAccount.smtpHost,
      port: senderAccount.smtpPort,
      secure: senderAccount.smtpPort === 465,
      auth: { user: senderAccount.smtpUser, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async sendEmail(params: {
    senderAccount: SenderAccountWithPass;
    to: string;
    name: string | null;
    subject: string;
    body: string;
  }): Promise<{ messageId: string; previewUrl: string | null }> {
    const { senderAccount, to, name, subject, body } = params;
    const isEthereal = senderAccount.smtpHost.includes('ethereal.email');
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, Render blocks all outbound SMTP ports (25, 465, 587).
    // Route Ethereal senders through Resend HTTP API instead.
    // In development, Ethereal SMTP works normally via localhost.
    if (isEthereal && isProduction) {
      logger.info('Production: routing Ethereal sender via Resend HTTP API', {
        to, subject,
        from: senderAccount.email,
      });
      return sendViaResend({
        fromName: senderAccount.name,
        // Resend free tier requires a verified sender domain.
        // Use Resend's built-in test address as the technical sender.
        fromEmail: 'onboarding@resend.dev',
        to: to,
        subject,
        html: body,
      });
    }

    // Local dev or non-Ethereal sender: use SMTP directly
    const transporter = this.createTransporter(senderAccount);
    const toAddress = name ? `"${name}" <${to}>` : to;
    const info = await transporter.sendMail({
      from: `"${senderAccount.name}" <${senderAccount.email}>`,
      to: toAddress,
      subject,
      html: body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    return {
      messageId: info.messageId,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
    };
  }

  async createEtherealAccount(): Promise<{
    host: string;
    port: number;
    user: string;
    pass: string;
  }> {
    const testAccount = await nodemailer.createTestAccount();
    return {
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      user: testAccount.user,
      pass: testAccount.pass,
    };
  }
}

export const emailService = new EmailService();
