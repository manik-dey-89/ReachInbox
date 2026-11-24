process.env.DATABASE_URL = 'postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db';
const { PrismaClient } = require('/mnt/d/Mailora/reachinbox/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Get all users and their campaigns
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  console.log('Users:');
  users.forEach(u => console.log(`  ${u.id} ${u.email} ${u.name}`));

  // Find the campaign for 'test' subject
  const campaigns = await prisma.emailCampaign.findMany({
    where: { subject: 'test' },
    select: { id: true, subject: true, userId: true, status: true },
  });
  console.log('\nCampaigns with subject "test":');
  campaigns.forEach(c => console.log(`  campaign=${c.id.slice(0,8)} userId=${c.userId.slice(0,8)} status=${c.status}`));

  // Now test the full query with userId
  if (campaigns.length > 0) {
    const userId = campaigns[0].userId;
    console.log(`\nSearching with userId=${userId.slice(0,8)}...`);
    const jobs = await prisma.emailJob.findMany({
      where: {
        campaign: { userId },
        OR: [
          { recipient: { email: { contains: 'manikdey1999', mode: 'insensitive' } } },
          { campaign: { subject: { contains: 'manikdey1999', mode: 'insensitive' } } },
        ],
      },
      include: {
        recipient: { select: { email: true } },
        campaign: { select: { subject: true } },
      },
    });
    console.log(`Found ${jobs.length} jobs`);
    jobs.forEach(j => console.log(`  status=${j.status} email=${j.recipient?.email}`));
  }

  await prisma.$disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });
