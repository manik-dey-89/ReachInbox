import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the mocked redis module so we can spy on it
import { redis } from '../config/redis';
import { RateLimitService } from '../services/rateLimit.service';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = new RateLimitService();
    vi.clearAllMocks();
  });

  describe('checkAndIncrement', () => {
    it('returns allowed: true when Redis returns [1, ...] (Lua allowed)', async () => {
      (redis.eval as ReturnType<typeof vi.fn>).mockResolvedValueOnce([1, 1, 99]);
      const result = await service.checkAndIncrement('rate:global:test', 100, 3600);
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.remaining).toBe(99);
    });

    it('returns allowed: false when Redis returns [0, ...] (Lua denied)', async () => {
      (redis.eval as ReturnType<typeof vi.fn>).mockResolvedValueOnce([0, 100, 0]);
      const result = await service.checkAndIncrement('rate:global:test', 100, 3600);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(100);
      expect(result.remaining).toBe(0);
    });
  });

  describe('checkGlobalLimit', () => {
    it('returns allowed: true when Redis permits the request', async () => {
      (redis.eval as ReturnType<typeof vi.fn>).mockResolvedValueOnce([1, 1, 99]);
      const result = await service.checkGlobalLimit('20240101_12');
      expect(result.allowed).toBe(true);
    });

    it('returns allowed: false when the global limit is exhausted', async () => {
      (redis.eval as ReturnType<typeof vi.fn>).mockResolvedValueOnce([0, 100, 0]);
      const result = await service.checkGlobalLimit('20240101_12');
      expect(result.allowed).toBe(false);
    });
  });

  describe('checkSenderLimit', () => {
    it('returns allowed: true when sender has quota remaining', async () => {
      (redis.eval as ReturnType<typeof vi.fn>).mockResolvedValueOnce([1, 5, 45]);
      const result = await service.checkSenderLimit('sender-abc', '20240101_12');
      expect(result.allowed).toBe(true);
    });

    it('returns allowed: false when sender quota is exhausted', async () => {
      (redis.eval as ReturnType<typeof vi.fn>).mockResolvedValueOnce([0, 50, 0]);
      const result = await service.checkSenderLimit('sender-abc', '20240101_12');
      expect(result.allowed).toBe(false);
    });
  });

  describe('msUntilNextHour', () => {
    it('returns a number', () => {
      const ms = service.msUntilNextHour();
      expect(typeof ms).toBe('number');
    });

    it('returns a value between 0 and 3,600,000 ms (one hour)', () => {
      const ms = service.msUntilNextHour();
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThanOrEqual(3_600_000);
    });
  });

  describe('key namespacing', () => {
    it('uses different Redis keys for global and sender limits', async () => {
      const hour = '20240101_12';
      const senderId = 'sender-xyz';

      // Reset call tracking and capture the key argument
      (redis.eval as ReturnType<typeof vi.fn>).mockResolvedValue([1, 1, 99]);

      await service.checkGlobalLimit(hour);
      const globalCall = (redis.eval as ReturnType<typeof vi.fn>).mock.calls[0];
      const globalKey = globalCall[2] as string; // KEYS[1] is the 3rd argument

      vi.clearAllMocks();
      (redis.eval as ReturnType<typeof vi.fn>).mockResolvedValue([1, 1, 49]);

      await service.checkSenderLimit(senderId, hour);
      const senderCall = (redis.eval as ReturnType<typeof vi.fn>).mock.calls[0];
      const senderKey = senderCall[2] as string;

      expect(globalKey).not.toBe(senderKey);
      expect(globalKey).toContain('global');
      expect(senderKey).toContain('sender');
      expect(senderKey).toContain(senderId);
    });
  });
});
