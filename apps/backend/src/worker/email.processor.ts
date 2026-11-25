import { Job } from 'bullmq';
import type { EmailJobPayload } from '../shared-index';
import { prisma } from '../config/database';
import { emailService } from '../services/email.service';
import { rateLimitService } from '../services/rateLimit.service';
import { elasticsearchService } from '../services/elasticsearch.service';
import { slackService } from '../services/slack.service';
import logger from '../utils/logger';

export async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const {
    jobId,
    recipientId,
    campaignId,
    userId,
    senderAccountId,
    recipientEmail,
    recipientName,
    subject,
    body,
    idempotencyKey,
  } = job.data;

  logger.info('Processing email job', { jobId, recipientEmail, attempt: job.attemptsMade });

  // -------------------------------------------------------------------------
  // 1. Idempotency check
  // -------------------------------------------------------------------------
  const existingDelivery = await prisma.emailDeliveryLog.findFirst({
    where: { emailJobId: jobId, status: 'SENT' },
  });

  if (existingDelivery) {
    logger.info('Duplicate delivery prevented', { jobId, recipientEmail, idempotencyKey, existingDeliveryId: existingDelivery.id });
    return;
  }

  // -------------------------------------------------------------------------
  // 2. Mark as PROCESSING
  // -------------------------------------------------------------------------
  await prisma.emailJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', attempt: { increment: 1 } },
  });

  // -------------------------------------------------------------------------
  // Everything after PROCESSING is wrapped in a safety net. Any unexpected
  // throw (rate-limit service error, DB error, crypto error, SMTP error) is
  // caught here, the job is marked FAILED with a useful error message, and
  // the error is re-thrown so BullMQ retries it.
  // -------------------------------------------------------------------------
  try {
    // -----------------------------------------------------------------------
    // 3. Global hourly rate limit
    // -----------------------------------------------------------------------
    const hour = rateLimitService.getCurrentHourKey();
    const globalResult = await rateLimitService.checkGlobalLimit(hour);

    if (!globalResult.allowed) {
      const msDelay = rateLimitService.msUntilNextHour();
      logger.warn('Global rate limit reached — deferring job', { jobId, recipientEmail, delayMs: msDelay });
      await job.moveToDelayed(Date.now() + msDelay, job.token);
      await prisma.emailJob.update({ where: { id: jobId }, data: { status: 'RATE_LIMITED' } });
      await slackService.sendRateLimitNotification(userId, `⚠️ Global hourly email limit reached. Job for ${recipientEmail} rescheduled.`);
      return;
    }

    // -----------------------------------------------------------------------
    // 4. Per-sender hourly rate limit
    // -----------------------------------------------------------------------
    const senderResult = await rateLimitService.checkSenderLimit(senderAccountId, hour);

    if (!senderResult.allowed) {
      const msDelay = rateLimitService.msUntilNextHour();
      logger.warn('Sender rate limit reached — deferring job', { jobId, senderAccountId, recipientEmail, delayMs: msDelay });
      await job.moveToDelayed(Date.now() + msDelay, job.token);
      await prisma.emailJob.update({ where: { id: jobId }, data: { status: 'RATE_LIMITED' } });
      await slackService.sendRateLimitNotification(userId, `⚠️ Sender hourly limit reached for ${senderAccountId}. Job for ${recipientEmail} rescheduled.`);
      return;
    }

    // -----------------------------------------------------------------------
    // 5. Fetch SenderAccount (with encrypted SMTP password)
    // -----------------------------------------------------------------------
    const senderAccount = await prisma.senderAccount.findUnique({ where: { id: senderAccountId } });

    if (!senderAccount) {
      throw new Error(`SenderAccount ${senderAccountId} not found`);
    }

    // -----------------------------------------------------------------------
    // 6. Send email via Nodemailer
    // -----------------------------------------------------------------------
    const { messageId, previewUrl } = await emailService.sendEmail({
      senderAccount,
      to: recipientEmail,
      name: recipientName,
      subject,
      body,
    });

    // Success path — persist atomically
    await prisma.$transaction(async (tx) => {
      await tx.emailDeliveryLog.create({
        data: { emailJobId: jobId, recipientId, campaignId, status: 'SENT', smtpMessageId: messageId, smtpResponse: previewUrl, sentAt: new Date() },
      });
      await tx.emailRecipient.update({ where: { id: recipientId }, data: { status: 'SENT', sentAt: new Date() } });
      await tx.emailJob.update({ where: { id: jobId }, data: { status: 'COMPLETED', processedAt: new Date() } });

      const updatedCampaign = await tx.emailCampaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } },
      });
      if (updatedCampaign.sentCount >= updatedCampaign.totalRecipients) {
        await tx.emailCampaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED', completedAt: new Date() } });
      }

      await tx.auditLog.create({
        data: { userId, action: 'EMAIL_SENT', entityType: 'EmailJob', entityId: jobId, metadata: { recipientEmail, messageId, campaignId, idempotencyKey } },
      });
    });

    // ES indexing (non-fatal)
    await elasticsearchService.indexEmail(userId, { id: jobId, campaignId, recipientEmail, subject, status: 'SENT', scheduledAt: null, sentAt: new Date().toISOString(), errorMessage: null });

    logger.info('Email delivered successfully', { jobId, recipientEmail, messageId, previewUrl });

  } catch (err) {
    // -----------------------------------------------------------------------
    // Safety net: catches ALL errors from steps 3-6
    // Always marks the job FAILED so it doesn't stay stuck in PROCESSING
    // -----------------------------------------------------------------------
    const errorMessage = (err as Error).message ?? 'Unknown error';

    logger.error('Email job failed', { jobId, recipientEmail, error: errorMessage, attempt: job.attemptsMade });

    try {
      await prisma.$transaction(async (tx) => {
        // Upsert FAILED delivery log — avoids P2002 unique constraint on retry
        await tx.emailDeliveryLog.upsert({
          where: { emailJobId_status: { emailJobId: jobId, status: 'FAILED' } },
          create: { emailJobId: jobId, recipientId, campaignId, status: 'FAILED', smtpResponse: errorMessage, sentAt: null },
          update: { smtpResponse: errorMessage },
        });

        await tx.emailRecipient.update({ where: { id: recipientId }, data: { status: 'FAILED', failedAt: new Date(), failureReason: errorMessage } });
        await tx.emailJob.update({ where: { id: jobId }, data: { status: 'FAILED', lastError: errorMessage } });

        // Only increment failedCount on the final attempt to avoid overcounting
        const isFinalAttempt = job.attemptsMade >= (job.opts?.attempts ?? 1) - 1;
        if (isFinalAttempt) {
          const updatedCampaign = await tx.emailCampaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } });
          if ((updatedCampaign.sentCount + updatedCampaign.failedCount) >= updatedCampaign.totalRecipients) {
            await tx.emailCampaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED', completedAt: new Date() } });
          }
        }

        await tx.auditLog.create({
          data: { userId, action: 'EMAIL_FAILED', entityType: 'EmailJob', entityId: jobId, metadata: { recipientEmail, error: errorMessage, campaignId, idempotencyKey } },
        });
      });
    } catch (dbErr) {
      // DB write in failure path also failed — log it but still re-throw the original error
      logger.error('Failed to write failure state to DB', { jobId, error: (dbErr as Error).message });
    }

    // Re-throw so BullMQ retries the job
    throw err;
  }
}
