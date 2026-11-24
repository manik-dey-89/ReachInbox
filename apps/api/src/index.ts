import { config } from './config';
import logger from './utils/logger';

async function main(): Promise<void> {
  // Dynamically import heavy singletons after config is validated
  const { prisma } = await import('./config/database');
  const { redis } = await import('./config/redis');
  const { esClient } = await import('./config/elasticsearch');
  const { createApp } = await import('./app');

  // Connect Redis
  try {
    await redis.connect();
    logger.info('Redis ready');
  } catch (err) {
    logger.error('Failed to connect to Redis', { error: (err as Error).message });
    process.exit(1);
  }

  // Connect Prisma (lazy — first query triggers connection)
  try {
    await prisma.$connect();
    logger.info('Prisma connected to database');
  } catch (err) {
    logger.error('Failed to connect to database', { error: (err as Error).message });
    process.exit(1);
  }

  // Elasticsearch connection is attempted non-fatally inside the singleton
  void esClient;

  // Start HTTP server
  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    logger.info('ReachInbox API server started', {
      host: config.host,
      port: config.port,
      env: config.nodeEnv,
      bullBoard: `http://${config.host}:${config.port}/admin/queues`,
    });
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  async function shutdown(signal: string): Promise<void> {
    logger.info(`${signal} received — shutting down gracefully`);

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
