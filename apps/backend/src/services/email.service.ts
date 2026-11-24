import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { decryptPassword } from '../utils/crypto';
import type { SenderAccount } from '@reachinbox/shared';

export interface SenderAccountWithPass extends SenderAccount {
  smtpPassEncrypted: string;
}

export class EmailService {
  createTransporter(senderAccount: SenderAccountWithPass): Transporter {
    const pass = decryptPassword(senderAccount.smtpPassEncrypted);
    return nodemailer.createTransport({
      host: senderAccount.smtpHost,
      port: senderAccount.smtpPort,
      secure: senderAccount.smtpPort === 465,
      auth: {
        user: senderAccount.smtpUser,
        pass,
      },
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
      port: testAccount.smtp.port,
      user: testAccount.user,
      pass: testAccount.pass,
    };
  }
}

export const emailService = new EmailService();
