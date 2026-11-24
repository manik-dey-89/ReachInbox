#!/bin/bash
export DATABASE_URL='postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db'
export REDIS_URL='redis://localhost:6379'
export SESSION_SECRET='d36fa095d2d4f42bdc0506f5fc3b563ca890155bbd02f3904c1b0854d7963a94'
export ENCRYPTION_KEY='2550adba5a76c5415717f689b4fe775a23450293cca0aa3c1882d06981e0c023'
export NODE_ENV=development
export API_PORT=3001
export CORS_ORIGIN='http://localhost:3000'
export GLOBAL_HOURLY_LIMIT=100
export SENDER_HOURLY_LIMIT=50
export ELASTICSEARCH_URL='http://localhost:9200'
export ADMIN_EMAIL='admin@example.com'

cd /mnt/d/Mailora/reachinbox/apps/api

timeout 10 node -e "
console.log('Loading queue...');
const { emailQueue } = require('./dist/config/queue');
console.log('Queue loaded:', typeof emailQueue);
setTimeout(() => { console.log('Done (queue did not hang)'); process.exit(0); }, 2000);
" 2>&1
echo "Exit: $?"
