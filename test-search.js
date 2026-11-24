// Test the search DB fallback directly via Prisma
process.env.DATABASE_URL = 'postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db';
const { PrismaClient } = require('/mnt/d/Mailora/reachinbox/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const q = 'manikdey1999@gmail.com';
  
  // Replicate the exact DB fallback query
  const whereJob = {
    campaign: { userId: undefined }, // no userId filter for this test
    OR: [
      { recipient: { email: { contains: q, mode: 'insensitive' } } },
      { campaign: { subject: { contains: q, mode: 'insensitive' } } },
    ],
  };

  // Search without userId filter to see ALL matching jobs
  const jobs = await prisma.emailJob.findMany({
    where: {
      OR: [
        { recipient: { email: { contains: q, mode: 'insensitive' } } },
        { campaign: { subject: { contains: q, mode: 'insensitive' } } },
      ],
    },
    include: {
      recipient: { select: { email: true, name: true } },
      campaign: { select: { subject: true, userId: true } },
    },
    take: 10,
  });

  console.log(`Found ${jobs.length} jobs matching "${q}":`);
  jobs.forEach(j => {
    console.log(`  - job=${j.id.slice(0,8)} status=${j.status} email=${j.recipient?.email} subject=${j.campaign?.subject}`);
  });

  // Also check recipients directly
  const recipients = await prisma.emailRecipient.findMany({
    where: { email: { contains: q, mode: 'insensitive' } },
    include: { campaign: { select: { subject: true, userId: true } } },
    take: 5,
  });
  console.log(`\nFound ${recipients.length} recipients matching "${q}":`);
  recipients.forEach(r => {
    console.log(`  - recipient=${r.id.slice(0,8)} email=${r.email} status=${r.status} campaign=${r.campaign?.subject}`);
  });

  await prisma.$disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
