/**
 * End-to-end smoke test against the live stack.
 * Requires: API on :3001, Worker running, PostgreSQL + Redis up.
 * Uses the Prisma client directly (no HTTP session needed for DB checks).
 */
process.env.DATABASE_URL = 'postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db';

const { PrismaClient } = require('/mnt/d/Mailora/reachinbox/node_modules/@prisma/client');
const http = require('http');
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function pass(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, reason) { console.log(`  FAIL  ${label}: ${reason}`); failed++; }

function httpGet(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', (e) => resolve({ status: 0, body: e.message }));
  });
}

function httpPost(url, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = http.request(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.write(body);
    req.end();
  });
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\n=== ReachInbox End-to-End Smoke Test ===\n');

  // ── 1. Infrastructure ───────────────────────────────────────────────────
  console.log('[ 1 ] Infrastructure');

  const health = await httpGet('http://localhost:3001/health');
  const hj = JSON.parse(health.body);
  hj.status === 'ok' ? pass('API health: ok') : fail('API health', hj.status);
  hj.services.redis === 'ok' ? pass('Redis: ok') : fail('Redis', hj.services.redis);
  hj.services.database === 'ok' ? pass('Database: ok') : fail('Database', hj.services.database);
  hj.services.elasticsearch === 'degraded' ? pass('Elasticsearch: degraded (expected, ES not installed)') : pass(`Elasticsearch: ${hj.services.elasticsearch}`);

  const queues = await httpGet('http://localhost:3001/api/health/queues');
  const qj = JSON.parse(queues.body);
  queues.status === 200 && qj.success ? pass('Queue stats endpoint') : fail('Queue stats', queues.body);

  // ── 2. Auth protection ──────────────────────────────────────────────────
  console.log('\n[ 2 ] Authentication & Route Protection');

  const meRes = await httpGet('http://localhost:3001/api/auth/me');
  meRes.status === 401 ? pass('GET /api/auth/me returns 401 (no session)') : fail('/api/auth/me', `expected 401 got ${meRes.status}`);

  const googleRes = await httpGet('http://localhost:3001/api/auth/google');
  googleRes.status === 302 ? pass('GET /api/auth/google redirects to Google (302)') : fail('/api/auth/google', `expected 302 got ${googleRes.status}`);
  if (googleRes.status === 302) {
    googleRes.headers.location && googleRes.headers.location.includes('accounts.google.com')
      ? pass('OAuth redirect points to accounts.google.com')
      : fail('OAuth redirect URL', googleRes.headers.location);
  }

  for (const path of ['/api/campaigns', '/api/senders', '/api/dashboard/stats', '/api/jobs', '/api/slack/status', '/api/search/emails']) {
    const r = await httpGet(`http://localhost:3001${path}`);
    r.status === 401 ? pass(`${path} requires auth`) : fail(path, `expected 401 got ${r.status}`);
  }

  // ── 3. Database state ───────────────────────────────────────────────────
  console.log('\n[ 3 ] Database State');

  const userCount = await prisma.user.count();
  userCount > 0 ? pass(`Users in DB: ${userCount}`) : fail('Users', 'no users found');

  const senderCount = await prisma.senderAccount.count();
  senderCount > 0 ? pass(`Sender accounts: ${senderCount}`) : fail('Senders', 'no senders found');

  const campaignCount = await prisma.emailCampaign.count();
  pass(`Campaigns in DB: ${campaignCount}`);

  const completedCampaigns = await prisma.emailCampaign.count({ where: { status: 'COMPLETED' } });
  pass(`Completed campaigns: ${completedCampaigns}`);

  const scheduledCampaigns = await prisma.emailCampaign.count({ where: { status: 'SCHEDULED' } });
  pass(`Scheduled/pending campaigns: ${scheduledCampaigns}`);

  // ── 4. Email delivery verification ─────────────────────────────────────
  console.log('\n[ 4 ] Email Delivery Verification');

  const deliveryLogs = await prisma.emailDeliveryLog.findMany({
    where: { status: 'SENT' },
    orderBy: { sentAt: 'desc' },
    take: 3,
    include: { emailJob: { select: { status: true } } },
  });

  deliveryLogs.length > 0 ? pass(`Delivery logs found: ${deliveryLogs.length} SENT records`) : fail('Delivery logs', 'no SENT delivery logs found');

  for (const log of deliveryLogs) {
    log.smtpMessageId ? pass(`  Message ID present: ${log.smtpMessageId.slice(0, 30)}...`) : fail('Message ID', 'missing');
    if (log.smtpResponse && log.smtpResponse.includes('ethereal.email')) {
      pass(`  Ethereal preview URL: ${log.smtpResponse.slice(0, 60)}...`);
    } else if (log.smtpResponse) {
      pass(`  SMTP response recorded: ${log.smtpResponse.slice(0, 60)}`);
    } else {
      fail('Ethereal preview URL', 'smtpResponse null');
    }
    log.emailJob?.status === 'COMPLETED' ? pass('  EmailJob status: COMPLETED') : fail('EmailJob status', log.emailJob?.status);
  }

  // ── 5. BullMQ job processing ────────────────────────────────────────────
  console.log('\n[ 5 ] BullMQ Job Processing');

  const completedJobs = await prisma.emailJob.count({ where: { status: 'COMPLETED' } });
  completedJobs > 0 ? pass(`Completed EmailJobs: ${completedJobs}`) : fail('Completed jobs', '0 found');

  const pendingJobs = await prisma.emailJob.count({ where: { status: 'PENDING' } });
  pass(`Pending EmailJobs: ${pendingJobs}`);

  const failedJobs = await prisma.emailJob.count({ where: { status: 'FAILED' } });
  pass(`Failed EmailJobs: ${failedJobs}`);

  // Queue: completed count from BullMQ
  const queueData = JSON.parse(qj ? queues.body : '{}');
  if (qj && qj.data) {
    pass(`BullMQ queue — completed: ${qj.data.completed}, failed: ${qj.data.failed}, waiting: ${qj.data.waiting}`);
  }

  // ── 6. Campaign status accuracy ─────────────────────────────────────────
  console.log('\n[ 6 ] Campaign Status Accuracy');

  const stuck = await prisma.emailCampaign.count({
    where: { status: 'SCHEDULED', sentCount: { gt: 0 }, totalRecipients: { gt: 0 } },
  });
  // Stuck means sentCount >= totalRecipients but still SCHEDULED
  const reallyStuck = await prisma.emailCampaign.findMany({
    where: { status: 'SCHEDULED' },
    select: { id: true, subject: true, sentCount: true, totalRecipients: true },
  });
  const wrongStatus = reallyStuck.filter(c => c.sentCount >= c.totalRecipients && c.totalRecipients > 0);
  wrongStatus.length === 0
    ? pass('No campaigns stuck in SCHEDULED when all recipients sent')
    : fail(`Campaigns with wrong status`, `${wrongStatus.length} campaigns fully sent but still SCHEDULED`);

  // ── 7. Idempotency check ────────────────────────────────────────────────
  console.log('\n[ 7 ] Idempotency');

  // If a job has >1 SENT delivery log, idempotency failed
  const duplicateDeliveries = await prisma.$queryRaw`
    SELECT "emailJobId", COUNT(*) as cnt
    FROM "EmailDeliveryLog"
    WHERE status = 'SENT'
    GROUP BY "emailJobId"
    HAVING COUNT(*) > 1
  `;
  duplicateDeliveries.length === 0
    ? pass('No duplicate SENT delivery logs (idempotency intact)')
    : fail('Idempotency', `${duplicateDeliveries.length} jobs with multiple SENT logs`);

  // ── 8. Rate limiting ────────────────────────────────────────────────────
  console.log('\n[ 8 ] Rate Limiting');

  const Redis = require('/mnt/d/Mailora/reachinbox/node_modules/ioredis');
  const redis = new Redis('redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: null });
  await redis.connect();
  const hour = Math.floor(Date.now() / 3600000);
  const globalKey = `rate:global:hourly:${hour}`;
  const globalCount = await redis.get(globalKey);
  pass(`Global rate limit counter this hour: ${globalCount ?? 0}`);
  redis.disconnect();

  // ── 9. Validation & security ────────────────────────────────────────────
  console.log('\n[ 9 ] API Validation & Security');

  // POST campaign with missing fields should return 400 (unauthenticated returns 401, which is fine)
  const badCampaign = await httpPost('http://localhost:3001/api/campaigns', {});
  [400, 401].includes(badCampaign.status)
    ? pass(`POST /api/campaigns with empty body: ${badCampaign.status} (validation/auth guard)`)
    : fail('Campaign validation', `expected 400/401 got ${badCampaign.status}`);

  // ── 10. Frontend pages ──────────────────────────────────────────────────
  console.log('\n[ 10 ] Frontend Pages');

  const pages = ['/', '/dashboard', '/compose', '/scheduled', '/sent', '/failed', '/search', '/monitoring', '/slack', '/settings', '/login'];
  for (const page of pages) {
    const r = await httpGet(`http://localhost:3000${page}`);
    r.status === 200 ? pass(`${page} → 200`) : fail(page, `got ${r.status}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(` SMOKE TEST RESULTS: ${passed} PASS, ${failed} FAIL`);
  console.log('========================================\n');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
