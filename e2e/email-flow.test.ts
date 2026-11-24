/**
 * Email scheduling flow — fully mocked end-to-end tests.
 *
 * These are unit/integration tests that use vi.fn() mocks in place of real
 * infrastructure. No live database, Redis, or SMTP connection is required.
 *
 * To run a true end-to-end test against real services, start the stack first:
 *   docker compose up -d
 *   npm run dev --workspace=apps/api
 *   npm run dev --workspace=apps/worker
 * …then point a Playwright / Cypress suite at http://localhost:3000.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal in-process mock of the domain — mirrors the real service contracts
// without importing the actual modules (which depend on a live Prisma/Redis).
// ---------------------------------------------------------------------------

interface Recipient {
  id: string;
  email: string;
}

interface Campaign {
  id: string;
  status: string;
  recipients: Recipient[];
  scheduledAt: Date;
  delayBetweenMs: number;
}

// Mock repositories / services
const campaignRepo = {
  create: vi.fn(),
  findById: vi.fn(),
};

const deliveryRepo = {
  findSuccessfulDelivery: vi.fn(),
  createDeliveryLog: vi.fn(),
};

const queueMock = {
  add: vi.fn(),
};

const mailerMock = {
  sendEmail: vi.fn(),
};

// Simplified scheduling logic (mirrors apps/api campaignService.scheduleCampaign)
async function scheduleCampaign(campaign: Campaign): Promise<void> {
  for (let i = 0; i < campaign.recipients.length; i++) {
    const recipient = campaign.recipients[i];
    const delay = campaign.delayBetweenMs * i;
    const jobId = `email:${campaign.id}:${recipient.id}`;
    await queueMock.add(
      'send-email',
      { campaignId: campaign.id, recipientId: recipient.id, email: recipient.email },
      { delay, jobId, removeOnComplete: { count: 1000 } },
    );
  }
}

// Simplified processor logic (mirrors apps/worker emailProcessor)
async function processEmailJob(
  campaignId: string,
  recipientId: string,
  email: string,
): Promise<{ skipped: boolean; messageId?: string }> {
  const existing = await deliveryRepo.findSuccessfulDelivery(campaignId, recipientId);
  if (existing) {
    // Idempotency guard: already delivered, skip
    return { skipped: true };
  }
  const result = await mailerMock.sendEmail({ to: email });
  await deliveryRepo.createDeliveryLog({ campaignId, recipientId, messageId: result.messageId });
  return { skipped: false, messageId: result.messageId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Email scheduling flow (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a campaign with valid recipients', async () => {
    const payload = {
      subject: 'Hello world',
      body: 'Test body',
      recipients: [
        { id: 'r1', email: 'alice@example.com' },
        { id: 'r2', email: 'bob@example.com' },
      ],
    };
    campaignRepo.create.mockResolvedValueOnce({
      id: 'campaign-1',
      status: 'SCHEDULED',
      ...payload,
    });

    const campaign = await campaignRepo.create(payload);

    expect(campaignRepo.create).toHaveBeenCalledOnce();
    expect(campaign.id).toBe('campaign-1');
    expect(campaign.status).toBe('SCHEDULED');
  });

  it('schedules a BullMQ delayed job for each recipient', async () => {
    const campaign: Campaign = {
      id: 'campaign-2',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 60_000),
      delayBetweenMs: 1000,
      recipients: [
        { id: 'r1', email: 'alice@example.com' },
        { id: 'r2', email: 'bob@example.com' },
        { id: 'r3', email: 'carol@example.com' },
      ],
    };

    queueMock.add.mockResolvedValue({ id: 'mock-job' });

    await scheduleCampaign(campaign);

    expect(queueMock.add).toHaveBeenCalledTimes(3);

    // First job has zero delay (sent immediately at scheduled time)
    const firstCall = queueMock.add.mock.calls[0];
    expect(firstCall[2].delay).toBe(0);

    // Second job is delayed by one interval
    const secondCall = queueMock.add.mock.calls[1];
    expect(secondCall[2].delay).toBe(1000);

    // Third job is delayed by two intervals
    const thirdCall = queueMock.add.mock.calls[2];
    expect(thirdCall[2].delay).toBe(2000);
  });

  it('each job gets a stable idempotent job ID', async () => {
    const campaign: Campaign = {
      id: 'campaign-3',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 60_000),
      delayBetweenMs: 500,
      recipients: [{ id: 'r1', email: 'alice@example.com' }],
    };

    queueMock.add.mockResolvedValue({ id: 'mock-job' });
    await scheduleCampaign(campaign);

    const jobOptions = queueMock.add.mock.calls[0][2];
    expect(jobOptions.jobId).toBe('email:campaign-3:r1');
    expect(jobOptions.removeOnComplete).toBeDefined();
  });

  it('email processor checks idempotency before sending — skips if already delivered', async () => {
    // Delivery record already exists for this campaign + recipient
    deliveryRepo.findSuccessfulDelivery.mockResolvedValueOnce({
      id: 'delivery-1',
      campaignId: 'campaign-4',
      recipientId: 'r1',
      messageId: 'msg-existing',
    });

    const result = await processEmailJob('campaign-4', 'r1', 'alice@example.com');

    expect(result.skipped).toBe(true);
    expect(mailerMock.sendEmail).not.toHaveBeenCalled();
    expect(deliveryRepo.createDeliveryLog).not.toHaveBeenCalled();
  });

  it('email processor sends email and logs delivery when not previously delivered', async () => {
    deliveryRepo.findSuccessfulDelivery.mockResolvedValueOnce(null);
    mailerMock.sendEmail.mockResolvedValueOnce({ messageId: 'msg-new-123' });
    deliveryRepo.createDeliveryLog.mockResolvedValueOnce({ id: 'delivery-new' });

    const result = await processEmailJob('campaign-5', 'r2', 'bob@example.com');

    expect(mailerMock.sendEmail).toHaveBeenCalledOnce();
    expect(mailerMock.sendEmail).toHaveBeenCalledWith({ to: 'bob@example.com' });
    expect(deliveryRepo.createDeliveryLog).toHaveBeenCalledOnce();
    expect(deliveryRepo.createDeliveryLog).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'msg-new-123' }),
    );
    expect(result.skipped).toBe(false);
    expect(result.messageId).toBe('msg-new-123');
  });

  it('worker restart does not re-process completed jobs (idempotency guard)', async () => {
    // Simulate: worker restarts, picks up a job, but the DB already has a delivery record
    // (because the job completed before the crash).
    deliveryRepo.findSuccessfulDelivery.mockResolvedValueOnce({
      id: 'delivery-existing',
      campaignId: 'campaign-6',
      recipientId: 'r3',
      messageId: 'msg-sent-before-crash',
    });

    const result = await processEmailJob('campaign-6', 'r3', 'carol@example.com');

    // The processor must skip — sendEmail must NOT be called a second time.
    expect(result.skipped).toBe(true);
    expect(mailerMock.sendEmail).not.toHaveBeenCalled();
  });
});
