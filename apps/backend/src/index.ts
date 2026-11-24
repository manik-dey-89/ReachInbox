import { config } from './config';
import logger from './utils/logger';
import { startInlineWorker, closeInlineWorker } from './worker/inline-worker';

async function main(): Promise<void> {
  console.log('[startup] main() called, loading singletons...');
  // Dynamically import heavy singletons after config is validated
  console.log('[startup] importing prisma...');
  const { prisma } = await import('./config/database');
  console.log('[startup] importing redis...');
  const { redis } = await import('./config/redis');
  console.log('[startup] importing esClient...');
  const { esClient } = await import('./config/elasticsearch');
  console.log('[startup] importing app...');
  const { createApp } = await import('./app');
  console.log('[startup] app module loaded');

  // Connect Redis
  try {
    console.log('[startup] connecting Redis...');
    await redis.connect();
    logger.info('Redis ready');
    console.log('[startup] Redis connected');
  } catch (err) {
    logger.error('Failed to connect to Redis', { error: (err as Error).message });
    process.exit(1);
  }

  // Connect Prisma (lazy — first query triggers connection)
  try {
    console.log('[startup] connecting Prisma...');
    await prisma.$connect();
    logger.info('Prisma connected to database');
  } catch (err) {
    logger.error('Failed to connect to database', { error: (err as Error).message });
    process.exit(1);
  }

  // Elasticsearch connection is attempted non-fatally inside the singleton
  void esClient;

  // Start HTTP server
  console.log('[startup] creating app...');
  const app = createApp();
  console.log('[startup] starting listen on port', config.port);
  const server = app.listen(config.port, config.host, () => {
    logger.info('ReachInbox API server started', {
      host: config.host,
      port: config.port,
      env: config.nodeEnv,
      bullBoard: `http://${config.host}:${config.port}/admin/queues`,
    });
  });

  // ---------------------------------------------------------------------------
  // Inline BullMQ worker (optional).
  // When ENABLE_INLINE_WORKER=true a Worker runs inside this process so a
  // single Render free web service can drain the queue without a paid
  // background worker. Disabled by default; the standalone apps/worker entry
  // point remains available for dedicated deployments.
  // ---------------------------------------------------------------------------
  const inlineWorker = await startInlineWorker();

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  async function shutdown(signal: string): Promise<void> {
    logger.info(`${signal} received — shutting down gracefully`);

    // 1. Drain in-flight jobs and close the inline worker first.
    await closeInlineWorker(inlineWorker);

    // 2. Stop accepting new HTTP requests, then release DB/Redis connections.
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await prisma.$disconnect();
        logger.info('Prisma disconnected');
      } catch (err) {
        logger.error('Error disconnecting Prisma', { error: (err as Error).message });
      }

      try {
        redis.disconnect();
        logger.info('Redis disconnected');
      } catch (err) {
        logger.error('Error disconnecting Redis', { error: (err as Error).message });
      }

      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 15_000).unref();
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
