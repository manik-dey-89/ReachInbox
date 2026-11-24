import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The processor depends on email/slack/elasticsearch services. Mock them so
// tests never touch SMTP, Slack webhooks, or Elasticsearch. The real
// RateLimitService is used (it only talks to the mocked Redis), and Prisma
// is the shared mock from setup.ts (augmented below with the real delegate
// names the processor uses).
vi.mock('../services/email.service', () => ({
  emailService: { sendEmail: vi.fn() },
}));
vi.mock('../services/slack.service', () => ({
  slackService: { sendRateLimitNotification: vi.fn() },
}));
vi.mock('../services/elasticsearch.service', () => ({
  elasticsearchService: { indexEmail: vi.fn() },
}));

import { Worker, type Job } from 'bullmq';
import type { EmailJobPayload } from '../shared-index';
import { config } from '../config';
import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { emailService } from '../services/email.service';
import { slackService } from '../services/slack.service';
import { elasticsearchService } from '../services/elasticsearch.service';
import { processEmailJob } from '../worker/email.processor';
import { startInlineWorker, closeInlineWorker } from '../worker/inline-worker';

// setup.ts mocks Prisma with short delegate names (campaign, recipient,
// emailDelivery) that don't match the real delegates the processor uses
// (emailCampaign, emailRecipient, emailDeliveryLog). Treat the mock loosely
// and attach the correct delegates per test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = prisma;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const r: any = redis;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mail: any = emailService;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slack: any = slackService;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const es: any = elasticsearchService;

const senderAccountRecord = {
  id: 'sender-1',
  userId: 'user-1',
  name: 'Sender',
  email: 'from@example.com',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUser: 'from@example.com',
  smtpPassEncrypted: 'enc',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeJob(overrides: Partial<EmailJobPayload> = {}): Job<EmailJobPayload> {
  return {
    data: {
      jobId: 'job-1',
      recipientId: 'rec-1',
      campaignId: 'camp-1',
      userId: 'user-1',
      senderAccountId: 'sender-1',
      recipientEmail: 'to@example.com',
      recipientName: 'To Name',
      subject: 'Subject',
      body: '<p>Body</p>',
      attempt: 0,
      idempotencyKey: 'idem-1',
      ...overrides,
    },
    attemptsMade: 0,
    token: 'tok-1',
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job<EmailJobPayload>;
}

beforeEach(() => {
  vi.clearAllMocks();

  // Deterministic Prisma behaviour for the processor path. $transaction runs
  // the callback with the mock prisma so `tx` resolves to the same delegates.
  db.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db));
  db.emailDeliveryLog = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  };
  db.emailRecipient = { update: vi.fn().mockResolvedValue({}) };
  db.emailCampaign = {
    update: vi.fn().mockResolvedValue({ sentCount: 1, totalRecipients: 10, failedCount: 0 }),
  };
  db.emailJob.update = vi.fn().mockResolvedValue({});
  db.senderAccount.findUnique = vi.fn().mockResolvedValue(null);
  db.auditLog.create = vi.fn().mockResolvedValue({});

  // Real RateLimitService reads from the mocked Redis. Default: allowed.
  r.eval.mockReset();
  r.eval.mockResolvedValue([1, 1, 99]);

  // Service mocks with sensible defaults, overridden per test.
  mail.sendEmail = vi.fn().mockResolvedValue({ messageId: 'mid-1', previewUrl: 'preview' });
  slack.sendRateLimitNotification = vi.fn().mockResolvedValue(undefined);
  es.indexEmail = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.ENABLE_INLINE_WORKER;
});

describe('startInlineWorker', () => {
  it('returns null when ENABLE_INLINE_WORKER is unset', async () => {
    delete process.env.ENABLE_INLINE_WORKER;
    expect(await startInlineWorker()).toBeNull();
  });

  it('returns null when ENABLE_INLINE_WORKER=false', async () => {
    process.env.ENABLE_INLINE_WORKER = 'false';
    expect(await startInlineWorker()).toBeNull();
  });

  it('starts a Worker on email-queue with config concurrency when true', async () => {
    process.env.ENABLE_INLINE_WORKER = 'true';
    const worker = await startInlineWorker();
    expect(worker).not.toBeNull();
    expect(Worker).toHaveBeenCalledWith(
      'email-queue',
      expect.any(Function),
      expect.objectContaining({ concurrency: config.workerConcurrency }),
    );
    await worker!.close();
  });
});

describe('closeInlineWorker', () => {
  it('is a no-op when the worker is null', async () => {
    await expect(closeInlineWorker(null)).resolves.toBeUndefined();
  });

  it('calls worker.close() when given a worker', async () => {
    const worker = { close: vi.fn().mockResolvedValue(undefined) };
    await closeInlineWorker(worker);
    expect(worker.close).toHaveBeenCalledTimes(1);
  });

  it('force-closes (close(true)) when draining exceeds the timeout', async () => {
    const worker = {
      close: vi.fn((force?: boolean) =>
        force ? Promise.resolve() : new Promise<void>(() => {}),
      ),
    };
    await closeInlineWorker(worker, 50);
    expect(worker.close).toHaveBeenCalledTimes(2);
    expect(worker.close).toHaveBeenNthCalledWith(2, true);
  });
});

describe('processEmailJob', () => {
  it('skips sending when a SENT delivery already exists (idempotency)', async () => {
    db.emailDeliveryLog.findFirst.mockResolvedValueOnce({ id: 'del-1', status: 'SENT' });
    await processEmailJob(makeJob());
    expect(mail.sendEmail).not.toHaveBeenCalled();
    expect(db.emailJob.update).not.toHaveBeenCalled();
  });

  it('marks the job PROCESSING before sending', async () => {
    db.senderAccount.findUnique.mockResolvedValue(senderAccountRecord);
    await processEmailJob(makeJob());
    expect(db.emailJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'PROCESSING', attempt: { increment: 1 } }),
      }),
    );
  });

  it('defers the job when the global rate limit is exceeded', async () => {
    r.eval.mockResolvedValueOnce([0, 100, 0]); // global denied
    const job = makeJob();
    await processEmailJob(job);
    expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    expect(db.emailJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RATE_LIMITED' }) }),
    );
    expect(slack.sendRateLimitNotification).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it('defers the job when the sender rate limit is exceeded', async () => {
    r.eval.mockResolvedValueOnce([1, 1, 99]); // global allowed
    r.eval.mockResolvedValueOnce([0, 50, 0]); // sender denied
    const job = makeJob();
    await processEmailJob(job);
    expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    expect(db.emailJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RATE_LIMITED' }) }),
    );
    expect(slack.sendRateLimitNotification).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it('throws when the sender account is not found', async () => {
    db.senderAccount.findUnique.mockResolvedValue(null);
    await expect(processEmailJob(makeJob())).rejects.toThrow(/SenderAccount.*not found/);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it('sends, persists SENT/COMPLETED, and indexes on success', async () => {
    db.senderAccount.findUnique.mockResolvedValue(senderAccountRecord);
    await processEmailJob(makeJob());
    expect(mail.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        senderAccount: senderAccountRecord,
        to: 'to@example.com',
        subject: 'Subject',
      }),
    );
    expect(db.emailDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT', emailJobId: 'job-1' }) }),
    );
    expect(db.emailRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
    );
    expect(db.emailJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
    expect(db.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sentCount: { increment: 1 } }) }),
    );
    expect(es.indexEmail).toHaveBeenCalledTimes(1);
  });

  it('marks the campaign COMPLETED when sentCount reaches totalRecipients', async () => {
    db.senderAccount.findUnique.mockResolvedValue(senderAccountRecord);
    db.emailCampaign.update.mockResolvedValue({ sentCount: 10, totalRecipients: 10, failedCount: 0 });
    await processEmailJob(makeJob());
    expect(db.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }) }),
    );
  });

  it('records FAILED and re-throws when sending fails', async () => {
    db.senderAccount.findUnique.mockResolvedValue(senderAccountRecord);
    mail.sendEmail.mockRejectedValue(new Error('smtp down'));
    await expect(processEmailJob(makeJob())).rejects.toThrow('smtp down');
    expect(db.emailDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(db.emailRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', failureReason: 'smtp down' }) }),
    );
    expect(db.emailJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', lastError: 'smtp down' }) }),
    );
    expect(es.indexEmail).not.toHaveBeenCalled();
  });

  it('completes the campaign when all recipients are processed on failure', async () => {
    db.senderAccount.findUnique.mockResolvedValue(senderAccountRecord);
    mail.sendEmail.mockRejectedValue(new Error('smtp down'));
    db.emailCampaign.update.mockResolvedValue({ sentCount: 1, failedCount: 1, totalRecipients: 2 });
    await expect(processEmailJob(makeJob())).rejects.toThrow('smtp down');
    expect(db.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }) }),
    );
  });
});
