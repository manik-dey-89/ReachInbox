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

service postgresql start > /dev/null 2>&1
service redis-server start > /dev/null 2>&1
sleep 1

cd /mnt/d/Mailora/reachinbox/apps/api

echo "Starting API (may take 30-40s for Prisma engine warmup)..."
node dist/index.js > /tmp/api.log 2>&1 &
PID=$!
echo "PID: $PID"

# Wait up to 60s
for i in $(seq 1 60); do
  sleep 1
  if nc -z localhost 3001 2>/dev/null; then
    echo "Port 3001 open after ${i}s"
    break
  fi
  if ! kill -0 $PID 2>/dev/null; then
    echo "Process died at ${i}s"
    break
  fi
done

echo "--- Log output ---"
cat /tmp/api.log

echo "--- Health check ---"
curl -s http://localhost:3001/health | head -c 500 || echo "Health check failed"

echo "--- Process status ---"
kill -0 $PID 2>/dev/null && echo "Process still running" || echo "Process not running"

kill $PID 2>/dev/null
wait $PID 2>/dev/null
