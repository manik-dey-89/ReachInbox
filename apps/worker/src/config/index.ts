import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  WORKER_CONCURRENCY: z.string().default('5').transform(Number),
  WORKER_MAX_RETRIES: z.string().default('3').transform(Number),
  GLOBAL_HOURLY_LIMIT: z.string().default('100').transform(Number),
  SENDER_HOURLY_LIMIT: z.string().default('50').transform(Number),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),
});

function parseConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${errors}`);
  }

  const env = result.data;

  return {
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    elasticsearchUrl: env.ELASTICSEARCH_URL,
    workerConcurrency: env.WORKER_CONCURRENCY,
    workerMaxRetries: env.WORKER_MAX_RETRIES,
    globalHourlyLimit: env.GLOBAL_HOURLY_LIMIT,
    senderHourlyLimit: env.SENDER_HOURLY_LIMIT,
    encryptionKey: env.ENCRYPTION_KEY,
    isProduction: env.NODE_ENV === 'production',
  };
}

export type Config = ReturnType<typeof parseConfig>;
export const config = parseConfig();
