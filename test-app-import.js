process.stdout.write('START\n');
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

process.stdout.write('ENV SET\n');
process.on('uncaughtException', (err) => { process.stdout.write('UNCAUGHT: ' + err.message + '\n'); process.exit(1); });
process.on('unhandledRejection', (reason) => { process.stdout.write('REJECTION: ' + reason + '\n'); process.exit(1); });

process.stdout.write('Importing app...\n');
const app = require('/mnt/d/Mailora/reachinbox/apps/api/dist/app');
process.stdout.write('App imported: ' + Object.keys(app).join(',') + '\n');
setTimeout(() => { process.stdout.write('Done\n'); process.exit(0); }, 2000);
