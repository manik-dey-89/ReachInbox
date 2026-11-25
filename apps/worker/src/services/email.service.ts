import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import https from 'node:https';
import { decryptPassword } from '../utils/crypto';
import logger from '../utils/logger';

export interface SenderAccountRecord {
  id: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassEncrypted: string;
}

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
  createTransporter(sender: SenderAccountRecord): Transporter {
    const pass = decryptPassword(sender.smtpPassEncrypted);
    return nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: { user: sender.smtpUser, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async sendEmail(params: {
    sender: SenderAccountRecord;
    to: string;
    name: string | null;
    subject: string;
    body: string;
  }): Promise<{ messageId: string; previewUrl: string | null }> {
    const { sender, to, name, subject, body } = params;
    const isEthereal = sender.smtpHost.includes('ethereal.email');
    const isProduction = process.env.NODE_ENV === 'production';

    if (isEthereal && isProduction) {
      logger.info('Production: routing Ethereal sender via Resend HTTP API', {
        to, subject, from: sender.email,
      });
      return sendViaResend({
        fromName: sender.name,
        // Resend free tier requires a verified sender domain.
        // Use Resend's built-in test address as the technical sender.
        fromEmail: 'onboarding@resend.dev',
        to,
        subject,
        html: body,
      });
    }

    const transporter = this.createTransporter(sender);
    const info = await transporter.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: name ? `"${name}" <${to}>` : to,
      subject,
      html: body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    return {
      messageId: info.messageId as string,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
    };
  }
}

export const emailService = new EmailService();
