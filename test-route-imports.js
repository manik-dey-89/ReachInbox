process.env.DATABASE_URL = 'postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SESSION_SECRET = 'd36fa095d2d4f42bdc0506f5fc3b563ca890155bbd02f3904c1b0854d7963a94';
process.env.ENCRYPTION_KEY = '2550adba5a76c5415717f689b4fe775a23450293cca0aa3c1882d06981e0c023';
process.env.NODE_ENV = 'development';
process.env.API_PORT = '3001';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.GLOBAL_HOURLY_LIMIT = '100';
process.env.SENDER_HOURLY_LIMIT = '50';
process.env.ELASTICSEARCH_URL = 'http://localhost:9200';
process.env.ADMIN_EMAIL = 'admin@example.com';

const BASE = '/mnt/d/Mailora/reachinbox/apps/api/dist';

const routes = [
  'routes/auth.routes',
  'routes/campaign.routes',
  'routes/recipient.routes',
  'routes/job.routes',
  'routes/sender.routes',
  'routes/slack.routes',
  'routes/search.routes',
  'routes/dashboard.routes',
  'routes/rateLimits.routes',
  'routes/health.routes',
];

(async () => {
  for (const route of routes) {
    process.stdout.write(`Loading ${route}... `);
    const start = Date.now();
    try {
      require(`${BASE}/${route}`);
      process.stdout.write(`OK (${Date.now()-start}ms)\n`);
    } catch(e) {
      process.stdout.write(`ERROR: ${e.message}\n`);
    }
  }
  process.stdout.write('All routes loaded\n');
  process.exit(0);
})();

setTimeout(() => { process.stdout.write('\nTIMEOUT\n'); process.exit(1); }, 10000);
