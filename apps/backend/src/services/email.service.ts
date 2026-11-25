import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { decryptPassword } from '../utils/crypto';
import type { SenderAccount } from '../shared-index';

export interface SenderAccountWithPass extends SenderAccount {
  smtpPassEncrypted: string;
}

export class EmailService {
  createTransporter(senderAccount: SenderAccountWithPass): Transporter {
    const pass = decryptPassword(senderAccount.smtpPassEncrypted);

    // Ethereal on port 587 times out on Render (port 587 is blocked).
    // Automatically upgrade Ethereal port 587 → 465 (SSL) at runtime.
    const isEthereal = senderAccount.smtpHost.includes('ethereal.email');
    const port = isEthereal && senderAccount.smtpPort === 587 ? 465 : senderAccount.smtpPort;

    return nodemailer.createTransport({
      host: senderAccount.smtpHost,
      port,
      secure: port === 465,
      auth: {
        user: senderAccount.smtpUser,
        pass,
      },
      // Fail fast so BullMQ retries quickly rather than hanging for minutes
      connectionTimeout: 10_000,   // 10s to establish TCP connection
      greetingTimeout: 10_000,     // 10s for SMTP EHLO/HELO greeting
      socketTimeout: 20_000,       // 20s of socket inactivity before aborting
    });
  }

  async sendEmail(params: {
    senderAccount: SenderAccountWithPass;
    to: string;
    name: string | null;
    subject: string;
    body: string;
  }): Promise<{ messageId: string; previewUrl: string | null }> {
    const transporter = this.createTransporter(params.senderAccount);

    const info = await transporter.sendMail({
      from: `"${params.senderAccount.name}" <${params.senderAccount.email}>`,
      to: params.name ? `"${params.name}" <${params.to}>` : params.to,
      subject: params.subject,
      html: params.body,
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
      // Use port 465 (SSL) instead of 587 (STARTTLS).
      // Render free tier blocks outbound port 587; port 465 is allowed.
      port: 465,
      user: testAccount.user,
      pass: testAccount.pass,
    };
  }
}

export const emailService = new EmailService();
