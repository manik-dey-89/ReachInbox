const Redis = require('/mnt/d/Mailora/reachinbox/node_modules/ioredis');
const r = new Redis('redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: null });
r.connect()
  .then(() => { console.log('Redis OK'); return r.ping(); })
  .then(res => { console.log('PING response:', res); r.disconnect(); process.exit(0); })
  .catch(e => { console.error('Redis ERR:', e.message); process.exit(1); });
