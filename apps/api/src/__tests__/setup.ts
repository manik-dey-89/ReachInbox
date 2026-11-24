import { vi } from 'vitest';

// Set environment variables BEFORE any module is imported that reads them.
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-must-be-at-least-32-characters-long';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3001/auth/google/callback';
process.env.SLACK_CLIENT_ID = 'test-slack-client-id';
process.env.SLACK_CLIENT_SECRET = 'test-slack-client-secret';
process.env.SLACK_REDIRECT_URI = 'http://localhost:3001/api/slack/callback';

// Mock @prisma/client
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    campaign: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    recipient: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    emailJob: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    senderAccount: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    emailDelivery: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $on: vi.fn(),
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

// Mock ioredis
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    eval: vi.fn().mockResolvedValue([1, 1, 99]),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn().mockReturnThis(),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    duplicate: vi.fn(),
    status: 'ready',
  };
  const Redis = vi.fn(() => mockRedis);
  return { default: Redis };
});

// Mock bullmq
vi.mock('bullmq', () => {
  const Queue = vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnThis(),
  }));
  const Worker = vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  }));
  return { Queue, Worker };
});

// Mock config/database to return the mock prisma
vi.mock('../config/database', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    campaign: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    recipient: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    emailJob: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    senderAccount: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    emailDelivery: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $on: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

// Mock config/redis
vi.mock('../config/redis', () => {
  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    eval: vi.fn().mockResolvedValue([1, 1, 99]),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn().mockReturnThis(),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    duplicate: vi.fn(),
    status: 'ready',
  };
  return {
    redis: mockRedis,
    createRedisClient: vi.fn(() => mockRedis),
  };
});

// Mock config/queue
vi.mock('../config/queue', () => ({
  emailQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnThis(),
  },
  queueConnection: {
    on: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  },
}));

// Mock config/elasticsearch
vi.mock('../config/elasticsearch', () => ({
  esClient: {
    ping: vi.fn().mockResolvedValue(true),
    search: vi.fn().mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
    index: vi.fn().mockResolvedValue({ result: 'created' }),
    delete: vi.fn().mockResolvedValue({ result: 'deleted' }),
  },
}));

// Mock @elastic/elasticsearch to prevent actual connection attempts
vi.mock('@elastic/elasticsearch', () => {
  const Client = vi.fn(() => ({
    ping: vi.fn().mockResolvedValue(true),
    search: vi.fn().mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
    index: vi.fn().mockResolvedValue({ result: 'created' }),
    delete: vi.fn().mockResolvedValue({ result: 'deleted' }),
  }));
  return { Client };
});
