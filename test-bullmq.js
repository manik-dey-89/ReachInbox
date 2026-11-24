const { Queue } = require('/mnt/d/Mailora/reachinbox/node_modules/bullmq');

console.log('Creating BullMQ queue...');
const q = new Queue('test-queue', {
  connection: {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
});
console.log('Queue created:', typeof q);

setTimeout(async () => {
  try {
    const counts = await q.getJobCounts();
    console.log('Job counts:', counts);
    await q.close();
    console.log('Queue closed');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}, 1000);
