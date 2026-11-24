import { redis } from '../config/redis';
import { config } from '../config';
import type { RateLimitStatus } from '@reachinbox/shared';

// Lua script for atomic check-and-increment:
// KEYS[1] = rate key
// ARGV[1] = limit
// ARGV[2] = window seconds (3600)
// Returns: [allowed (0|1), current, remaining]
const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
  return {0, current, 0}
end
local new_val = redis.call('INCR', key)
if new_val == 1 then
  redis.call('EXPIRE', key, window)
end
return {1, new_val, limit - new_val}
`;

export class RateLimitService {
  async checkAndIncrement(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; current: number; remaining: number }> {
    const result = (await redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      key,
      String(limit),
      String(windowSeconds),
    )) as [number, number, number];

    return {
      allowed: result[0] === 1,
      current: result[1],
      remaining: result[2],
    };
  }

  getCurrentHourKey(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');
    return `${year}${month}${day}_${hour}`;
  }

  msUntilNextHour(): number {
    const now = Date.now();
    const nextHour = new Date(now);
    nextHour.setUTCMinutes(0, 0, 0);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    return Math.max(0, nextHour.getTime() - now);
  }

  async checkGlobalLimit(
    hour: string,
  ): Promise<{ allowed: boolean; current: number; remaining: number }> {
    const key = `rate:global:${hour}`;
    return this.checkAndIncrement(key, config.globalHourlyLimit, 3600);
  }

  async checkSenderLimit(
    senderId: string,
    hour: string,
  ): Promise<{ allowed: boolean; current: number; remaining: number }> {
    const key = `rate:sender:${senderId}:${hour}`;
    return this.checkAndIncrement(key, config.senderHourlyLimit, 3600);
  }

  async getStatus(userId: string, senderIds: string[]): Promise<RateLimitStatus> {
    const hour = this.getCurrentHourKey();
    const resetsAt = new Date(Date.now() + this.msUntilNextHour()).toISOString();

    const globalKey = `rate:global:${hour}`;
    const globalRaw = await redis.get(globalKey);
    const globalCurrent = Number(globalRaw ?? 0);
    const globalRemaining = Math.max(0, config.globalHourlyLimit - globalCurrent);

    const senderStatuses = await Promise.all(
      senderIds.map(async (senderId) => {
        const senderKey = `rate:sender:${senderId}:${hour}`;
        const senderRaw = await redis.get(senderKey);
        const senderCurrent = Number(senderRaw ?? 0);
        return {
          senderId,
          current: senderCurrent,
          limit: config.senderHourlyLimit,
          remaining: Math.max(0, config.senderHourlyLimit - senderCurrent),
          resetsAt,
        };
      }),
    );

    return {
      global: {
        current: globalCurrent,
        limit: config.globalHourlyLimit,
        remaining: globalRemaining,
        resetsAt,
      },
      senders: senderStatuses,
    };
  }
}

export const rateLimitService = new RateLimitService();
