import Redis from 'ioredis';
import { config } from './index';
import logger from '../utils/logger';

function createRedisClient(): Redis {
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on('error', (err: Error) => {
    logger.error('Redis connection error', { error: err.message });
  });

  client.on('connect', () => {
    logger.info('Redis connected');
  });

  client.on('reconnecting', () => {
    logger.warn('Redis reconnecting');
  });

  return client;
}

// Singleton for general use
const redis = createRedisClient();

export { redis, createRedisClient };
