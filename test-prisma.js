process.env.DATABASE_URL = 'postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db';
const { PrismaClient } = require('/mnt/d/Mailora/reachinbox/node_modules/@prisma/client');
const prisma = new PrismaClient();
console.log('Connecting to Prisma...');
prisma.$connect()
  .then(() => {
    console.log('Prisma connected!');
    return prisma.$queryRaw`SELECT 1 as ok`;
  })
  .then(r => {
    console.log('Query result:', r);
    return prisma.$disconnect();
  })
  .then(() => { console.log('Done'); process.exit(0); })
  .catch(e => { console.error('Prisma error:', e.message); process.exit(1); });

setTimeout(() => { console.error('TIMEOUT after 10s'); process.exit(2); }, 10000);
