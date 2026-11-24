import { campaignRepository } from '../repositories/campaign.repository';
import { rateLimitService } from './rateLimit.service';
import { auditService } from './audit.service';
import type { DashboardStats } from '@reachinbox/shared';
import { prisma } from '../config/database';

export class DashboardService {
  async getStats(userId: string): Promise<DashboardStats> {
    // Fetch base stats from campaign repository
    const stats = await campaignRepository.getDashboardStats(userId);

    // Fetch sender ids
    const senderIds = stats.senderStats.map((s) => s.senderId);

    // Pull rate limit status from Redis
    const rateLimitStatus = await rateLimitService.getStatus(userId, senderIds);

    // Merge hourly usage into stats
    stats.hourlyUsage = {
      global: rateLimitStatus.global.current,
      limit: rateLimitStatus.global.limit,
    };

    stats.senderStats = stats.senderStats.map((s) => {
      const senderLimit = rateLimitStatus.senders.find((sl) => sl.senderId === s.senderId);
      return {
        ...s,
        hourlyUsage: senderLimit?.current ?? 0,
        hourlyLimit: senderLimit?.limit ?? s.hourlyLimit,
      };
    });

    // Enrich with fresh audit logs
    const recentActivity = await auditService.getRecent(userId, 10);
    stats.recentActivity = recentActivity;

    return stats;
  }
}

export const dashboardService = new DashboardService();
