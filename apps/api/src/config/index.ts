import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3001').transform(Number),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  // Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_MAX_AGE_MS: z.string().default('86400000').transform(Number),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_CALLBACK_URL: z.string().url('GOOGLE_CALLBACK_URL must be a valid URL'),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string().min(1, 'SLACK_CLIENT_ID is required'),
  SLACK_CLIENT_SECRET: z.string().min(1, 'SLACK_CLIENT_SECRET is required'),
  SLACK_REDIRECT_URI: z.string().url('SLACK_REDIRECT_URI must be a valid URL'),

  // Encryption
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),

  // Rate limiting
  GLOBAL_HOURLY_LIMIT: z.string().default('100').transform(Number),
  SENDER_HOURLY_LIMIT: z.string().default('50').transform(Number),

  // Worker
  WORKER_CONCURRENCY: z.string().default('5').transform(Number),
  WORKER_MAX_RETRIES: z.string().default('3').transform(Number),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Admin
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email').default('admin@example.com'),

  // Aliases used in .env.example
  API_PORT: z.string().optional(),
  API_HOST: z.string().optional(),
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
    port: env.API_PORT ? Number(env.API_PORT) : env.PORT,
    host: env.API_HOST ?? env.HOST,
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    elasticsearchUrl: env.ELASTICSEARCH_URL,
    sessionSecret: env.SESSION_SECRET,
    sessionMaxAge: env.SESSION_MAX_AGE_MS,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: env.GOOGLE_CALLBACK_URL,
    slackClientId: env.SLACK_CLIENT_ID,
    slackClientSecret: env.SLACK_CLIENT_SECRET,
    slackRedirectUri: env.SLACK_REDIRECT_URI,
    encryptionKey: env.ENCRYPTION_KEY,
    globalHourlyLimit: env.GLOBAL_HOURLY_LIMIT,
    senderHourlyLimit: env.SENDER_HOURLY_LIMIT,
    workerConcurrency: env.WORKER_CONCURRENCY,
    workerMaxRetries: env.WORKER_MAX_RETRIES,
    corsOrigin: env.CORS_ORIGIN,
    adminEmail: env.ADMIN_EMAIL,
    isProduction: env.NODE_ENV === 'production',
  };
}

export type Config = ReturnType<typeof parseConfig>;
export const config = parseConfig();
