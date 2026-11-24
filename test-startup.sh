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

echo "Starting API..."
cd /mnt/d/Mailora/reachinbox/apps/api
node dist/index.js &
PID=$!
echo "PID: $PID"
sleep 8
echo "--- Checking if still running ---"
kill -0 $PID 2>/dev/null && echo "Still running" || echo "Process died"
# Try health check
curl -s http://localhost:3001/health && echo "" || echo "Health check failed"
kill $PID 2>/dev/null
wait $PID 2>/dev/null
echo "Done"
