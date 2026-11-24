import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { decryptPassword } from '../utils/crypto';

export interface SenderAccountRecord {
  id: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassEncrypted: string;
}

export class EmailService {
  createTransporter(sender: SenderAccountRecord): Transporter {
    const pass = decryptPassword(sender.smtpPassEncrypted);
    return nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: {
        user: sender.smtpUser,
        pass,
      },
    });
  }

  async sendEmail(params: {
    sender: SenderAccountRecord;
    to: string;
    name: string | null;
    subject: string;
    body: string;
  }): Promise<{ messageId: string; previewUrl: string | null }> {
    const transporter = this.createTransporter(params.sender);

    const info = await transporter.sendMail({
      from: `"${params.sender.name}" <${params.sender.email}>`,
      to: params.name ? `"${params.name}" <${params.to}>` : params.to,
      subject: params.subject,
      html: params.body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    return {
      messageId: info.messageId as string,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
    };
  }
}

export const emailService = new EmailService();
