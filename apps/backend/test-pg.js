const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'reachinbox_db',
  user: 'reachinbox',
  password: 'reachinbox_password',
  connectionTimeoutMillis: 5000
});
client.connect()
  .then(() => { console.log('PostgreSQL Connected!'); return client.query('SELECT version()'); })
  .then(r => { console.log('Version:', r.rows[0].version.split(' ').slice(0,2).join(' ')); client.end(); })
  .catch(e => { console.error('PostgreSQL Error:', e.message); process.exit(1); });
