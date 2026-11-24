import { Job } from 'bullmq';
import type { EmailJobPayload } from '@reachinbox/shared';
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
  // 1. Idempotency check: if a SENT delivery log already exists for this job,
  //    a previous attempt succeeded and was committed — skip to avoid a duplicate.
  // -------------------------------------------------------------------------
  const existingDelivery = await prisma.emailDeliveryLog.findFirst({
    where: {
      emailJobId: jobId,
      status: 'SENT',
    },
  });

  if (existingDelivery) {
    logger.info('Duplicate delivery prevented', {
      jobId,
      recipientEmail,
      idempotencyKey,
      existingDeliveryId: existingDelivery.id,
    });
    return;
  }

  // -------------------------------------------------------------------------
  // 2. Update EmailJob status to PROCESSING and increment attempt counter.
  // -------------------------------------------------------------------------
  await prisma.emailJob.update({
    where: { id: jobId },
    data: {
      status: 'PROCESSING',
      attempt: { increment: 1 },
    },
  });

  // -------------------------------------------------------------------------
  // 3. Check global hourly rate limit (atomic Lua script).
  // -------------------------------------------------------------------------
  const hour = rateLimitService.getCurrentHourKey();

  const globalResult = await rateLimitService.checkGlobalLimit(hour);

  if (!globalResult.allowed) {
    const msDelay = rateLimitService.msUntilNextHour();

    logger.warn('Global rate limit reached — deferring job', {
      jobId,
      recipientEmail,
      delayMs: msDelay,
    });

    await job.moveToDelayed(Date.now() + msDelay, job.token);

    await prisma.emailJob.update({
      where: { id: jobId },
      data: { status: 'RATE_LIMITED' },
    });

    await slackService.sendRateLimitNotification(
      userId,
      `⚠️ Global hourly email limit reached. Job for ${recipientEmail} has been rescheduled for the next hour.`,
    );

    return;
  }

  // -------------------------------------------------------------------------
  // 4. Check per-sender hourly rate limit.
  // -------------------------------------------------------------------------
  const senderResult = await rateLimitService.checkSenderLimit(senderAccountId, hour);

  if (!senderResult.allowed) {
    const msDelay = rateLimitService.msUntilNextHour();

    logger.warn('Sender rate limit reached — deferring job', {
      jobId,
      senderAccountId,
      recipientEmail,
      delayMs: msDelay,
    });

    await job.moveToDelayed(Date.now() + msDelay, job.token);

    await prisma.emailJob.update({
      where: { id: jobId },
      data: { status: 'RATE_LIMITED' },
    });

    await slackService.sendRateLimitNotification(
      userId,
      `⚠️ Sender hourly email limit reached for sender ${senderAccountId}. Job for ${recipientEmail} has been rescheduled for the next hour.`,
    );

    return;
  }

  // -------------------------------------------------------------------------
  // 5. Fetch SenderAccount (including encrypted SMTP password).
  // -------------------------------------------------------------------------
  const senderAccount = await prisma.senderAccount.findUnique({
    where: { id: senderAccountId },
  });

  if (!senderAccount) {
    throw new Error(`SenderAccount ${senderAccountId} not found`);
  }

  // -------------------------------------------------------------------------
  // 6. Send the email and persist results atomically.
  // -------------------------------------------------------------------------
  try {
    const { messageId, previewUrl } = await emailService.sendEmail({
      sender: senderAccount,
      to: recipientEmail,
      name: recipientName,
      subject,
      body,
    });

    // All success-path DB writes in a single transaction.
    await prisma.$transaction(async (tx) => {
      // Create SENT delivery log.
      await tx.emailDeliveryLog.create({
        data: {
          emailJobId: jobId,
          recipientId,
          campaignId,
          status: 'SENT',
          smtpMessageId: messageId,
          smtpResponse: previewUrl,
          sentAt: new Date(),
        },
      });

      // Mark recipient as SENT.
      await tx.emailRecipient.update({
        where: { id: recipientId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      // Mark job as COMPLETED.
      await tx.emailJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      // Atomically increment campaign sentCount.
      await tx.emailCampaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } },
      });

      // Audit log.
      await tx.auditLog.create({
        data: {
          userId,
          action: 'EMAIL_SENT',
          entityType: 'EmailJob',
          entityId: jobId,
          metadata: {
            recipientEmail,
            messageId,
            campaignId,
            idempotencyKey,
          },
        },
      });
    });

    // Index to Elasticsearch outside the transaction (graceful degradation on failure).
    await elasticsearchService.indexEmail(userId, {
      id: jobId,
      campaignId,
      recipientEmail,
      subject,
      status: 'SENT',
      scheduledAt: null,
      sentAt: new Date().toISOString(),
      errorMessage: null,
    });

    logger.info('Email delivered successfully', {
      jobId,
      recipientEmail,
      messageId,
      previewUrl,
    });
  } catch (sendErr) {
    const errorMessage = (sendErr as Error).message;

    logger.error('Email delivery failed', {
      jobId,
      recipientEmail,
      error: errorMessage,
      attempt: job.attemptsMade,
    });

    // All failure-path DB writes in a single transaction.
    await prisma.$transaction(async (tx) => {
      // Create FAILED delivery log.
      await tx.emailDeliveryLog.create({
        data: {
          emailJobId: jobId,
          recipientId,
          campaignId,
          status: 'FAILED',
          smtpResponse: errorMessage,
          sentAt: null,
        },
      });

      // Mark recipient as FAILED.
      await tx.emailRecipient.update({
        where: { id: recipientId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: errorMessage,
        },
      });

      // Mark job as FAILED.
      await tx.emailJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          lastError: errorMessage,
        },
      });

      // Atomically increment campaign failedCount.
      await tx.emailCampaign.update({
        where: { id: campaignId },
        data: { failedCount: { increment: 1 } },
      });

      // Audit log.
      await tx.auditLog.create({
        data: {
          userId,
          action: 'EMAIL_FAILED',
          entityType: 'EmailJob',
          entityId: jobId,
          metadata: {
            recipientEmail,
            error: errorMessage,
            campaignId,
            idempotencyKey,
          },
        },
      });
    });

    // Re-throw so BullMQ retry logic can schedule another attempt.
    throw sendErr;
  }
}
