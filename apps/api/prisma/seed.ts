import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test users
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob Smith',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
    },
  });

  console.log(`✅ Created users: ${alice.name}, ${bob.name}`);

  // Create sender accounts (SMTP password is a placeholder — encrypted in production)
  const aliceSender = await prisma.senderAccount.upsert({
    where: { userId_email: { userId: alice.id, email: 'alice@ethereal.email' } },
    update: {},
    create: {
      userId: alice.id,
      name: 'Alice (Ethereal)',
      email: 'alice@ethereal.email',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: 'alice@ethereal.email',
      smtpPassEncrypted: 'PLACEHOLDER_ENCRYPTED_PASSWORD',
    },
  });

  const bobSender = await prisma.senderAccount.upsert({
    where: { userId_email: { userId: bob.id, email: 'bob@ethereal.email' } },
    update: {},
    create: {
      userId: bob.id,
      name: 'Bob (Ethereal)',
      email: 'bob@ethereal.email',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: 'bob@ethereal.email',
      smtpPassEncrypted: 'PLACEHOLDER_ENCRYPTED_PASSWORD',
    },
  });

  console.log(`✅ Created sender accounts: ${aliceSender.email}, ${bobSender.email}`);

  // Create campaigns
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const draftCampaign = await prisma.emailCampaign.create({
    data: {
      userId: alice.id,
      senderAccountId: aliceSender.id,
      subject: 'Welcome to ReachInbox — Draft',
      body: '<h1>Hello {{name}},</h1><p>Welcome to our platform. This is a draft campaign.</p>',
      status: 'DRAFT',
      totalRecipients: 0,
      scheduledAt: oneHourFromNow,
      delayBetweenMs: 2000,
      hourlyLimit: 100,
    },
  });

  const scheduledCampaign = await prisma.emailCampaign.create({
    data: {
      userId: alice.id,
      senderAccountId: aliceSender.id,
      subject: 'Your Weekly Newsletter',
      body: '<h1>Hello {{name}},</h1><p>Here is your weekly update from the ReachInbox team.</p>',
      status: 'SCHEDULED',
      totalRecipients: 3,
      sentCount: 0,
      failedCount: 0,
      scheduledAt: oneHourFromNow,
      delayBetweenMs: 1500,
      hourlyLimit: 50,
    },
  });

  const completedCampaign = await prisma.emailCampaign.create({
    data: {
      userId: alice.id,
      senderAccountId: aliceSender.id,
      subject: 'Product Announcement',
      body: '<h1>Hello {{name}},</h1><p>We are excited to announce our new product features.</p>',
      status: 'COMPLETED',
      totalRecipients: 2,
      sentCount: 2,
      failedCount: 0,
      scheduledAt: yesterday,
      completedAt: new Date(yesterday.getTime() + 30 * 60 * 1000),
      delayBetweenMs: 1000,
    },
  });

  const bobCampaign = await prisma.emailCampaign.create({
    data: {
      userId: bob.id,
      senderAccountId: bobSender.id,
      subject: 'Bob\'s Outreach Campaign',
      body: '<h1>Hi {{name}},</h1><p>Reaching out about our services.</p>',
      status: 'SCHEDULED',
      totalRecipients: 2,
      sentCount: 0,
      failedCount: 0,
      scheduledAt: oneHourFromNow,
      delayBetweenMs: 3000,
      hourlyLimit: 20,
    },
  });

  console.log(`✅ Created campaigns: ${draftCampaign.id}, ${scheduledCampaign.id}, ${completedCampaign.id}, ${bobCampaign.id}`);

  // Add recipients to the scheduled campaign
  const scheduledRecipients = await prisma.$transaction([
    prisma.emailRecipient.create({
      data: {
        campaignId: scheduledCampaign.id,
        email: 'recipient1@example.com',
        name: 'Recipient One',
        status: 'PENDING',
      },
    }),
    prisma.emailRecipient.create({
      data: {
        campaignId: scheduledCampaign.id,
        email: 'recipient2@example.com',
        name: 'Recipient Two',
        status: 'PENDING',
      },
    }),
    prisma.emailRecipient.create({
      data: {
        campaignId: scheduledCampaign.id,
        email: 'recipient3@example.com',
        name: 'Recipient Three',
        status: 'PENDING',
      },
    }),
  ]);

  // Add recipients to the completed campaign with sent status
  const sentAt1 = new Date(yesterday.getTime() + 5 * 60 * 1000);
  const sentAt2 = new Date(yesterday.getTime() + 7 * 60 * 1000);

  const completedRecipients = await prisma.$transaction([
    prisma.emailRecipient.create({
      data: {
        campaignId: completedCampaign.id,
        email: 'sent1@example.com',
        name: 'Sent One',
        status: 'SENT',
        sentAt: sentAt1,
      },
    }),
    prisma.emailRecipient.create({
      data: {
        campaignId: completedCampaign.id,
        email: 'sent2@example.com',
        name: 'Sent Two',
        status: 'SENT',
        sentAt: sentAt2,
      },
    }),
  ]);

  // Add recipients to Bob's campaign
  await prisma.$transaction([
    prisma.emailRecipient.create({
      data: {
        campaignId: bobCampaign.id,
        email: 'lead1@example.com',
        name: 'Lead One',
        status: 'PENDING',
      },
    }),
    prisma.emailRecipient.create({
      data: {
        campaignId: bobCampaign.id,
        email: 'lead2@example.com',
        name: 'Lead Two',
        status: 'PENDING',
      },
    }),
  ]);

  console.log(`✅ Created recipients for campaigns`);

  // Create fake EmailJob and DeliveryLog records for the completed campaign
  const job1 = await prisma.emailJob.create({
    data: {
      recipientId: completedRecipients[0].id,
      campaignId: completedCampaign.id,
      bullJobId: `seed-job-${completedCampaign.id}-1`,
      status: 'COMPLETED',
      attempt: 1,
      scheduledFor: yesterday,
      processedAt: sentAt1,
    },
  });

  const job2 = await prisma.emailJob.create({
    data: {
      recipientId: completedRecipients[1].id,
      campaignId: completedCampaign.id,
      bullJobId: `seed-job-${completedCampaign.id}-2`,
      status: 'COMPLETED',
      attempt: 1,
      scheduledFor: yesterday,
      processedAt: sentAt2,
    },
  });

  await prisma.$transaction([
    prisma.emailDeliveryLog.create({
      data: {
        emailJobId: job1.id,
        recipientId: completedRecipients[0].id,
        campaignId: completedCampaign.id,
        status: 'SENT',
        smtpMessageId: `<seed-msg-1@ethereal.email>`,
        smtpResponse: '250 Accepted',
        sentAt: sentAt1,
      },
    }),
    prisma.emailDeliveryLog.create({
      data: {
        emailJobId: job2.id,
        recipientId: completedRecipients[1].id,
        campaignId: completedCampaign.id,
        status: 'SENT',
        smtpMessageId: `<seed-msg-2@ethereal.email>`,
        smtpResponse: '250 Accepted',
        sentAt: sentAt2,
      },
    }),
  ]);

  console.log(`✅ Created email jobs and delivery logs`);

  // Audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        userId: alice.id,
        action: 'CAMPAIGN_CREATED',
        entityType: 'EmailCampaign',
        entityId: draftCampaign.id,
        metadata: { subject: draftCampaign.subject },
      },
      {
        userId: alice.id,
        action: 'CAMPAIGN_SCHEDULED',
        entityType: 'EmailCampaign',
        entityId: scheduledCampaign.id,
        metadata: { subject: scheduledCampaign.subject, totalRecipients: 3 },
      },
      {
        userId: alice.id,
        action: 'CAMPAIGN_COMPLETED',
        entityType: 'EmailCampaign',
        entityId: completedCampaign.id,
        metadata: { subject: completedCampaign.subject, sentCount: 2 },
      },
      {
        userId: bob.id,
        action: 'CAMPAIGN_SCHEDULED',
        entityType: 'EmailCampaign',
        entityId: bobCampaign.id,
        metadata: { subject: bobCampaign.subject, totalRecipients: 2 },
      },
    ],
  });

  console.log(`✅ Created audit log entries`);
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
