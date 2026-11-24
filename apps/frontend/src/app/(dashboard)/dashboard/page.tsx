'use client';

import { Clock, CheckCircle, XCircle, Timer } from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { HourlyUsageChart } from '@/components/dashboard/HourlyUsageChart';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { SenderStats } from '@/components/dashboard/SenderStats';
import { StatsSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overview</h1>
        <StatsSkeleton />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overview</h1>
        <EmptyState
          icon={LayoutDashboard}
          title="No data yet"
          description="Start sending campaigns to see your dashboard statistics."
        />
      </div>
    );
  }

  // Build hourly usage chart data from stats — use a simple 24-hour placeholder if no history
  const chartData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    usage: i === new Date().getHours() ? stats.hourlyUsage.global : 0,
    limit: stats.hourlyUsage.limit,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Total Scheduled"
          value={stats.totalScheduled.toLocaleString()}
          icon={Clock}
        />
        <StatsCard
          title="Total Sent"
          value={stats.totalSent.toLocaleString()}
          icon={CheckCircle}
        />
        <StatsCard
          title="Failed"
          value={stats.totalFailed.toLocaleString()}
          icon={XCircle}
        />
        <StatsCard
          title="Pending"
          value={stats.totalPending.toLocaleString()}
          icon={Timer}
        />
      </div>

      {/* Hourly usage summary */}
      <Card>
        <CardHeader>
          <CardTitle>Global Hourly Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {stats.hourlyUsage.global} / {stats.hourlyUsage.limit} emails this hour
            </span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {stats.hourlyUsage.limit > 0
                ? Math.round((stats.hourlyUsage.global / stats.hourlyUsage.limit) * 100)
                : 0}
              %
            </span>
          </div>
          <Progress value={stats.hourlyUsage.global} max={stats.hourlyUsage.limit} />
        </CardContent>
      </Card>

      {/* Chart + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HourlyUsageChart data={chartData} />
        <ActivityFeed activities={stats.recentActivity} />
      </div>

      {/* Sender stats */}
      <SenderStats senders={stats.senderStats} />
    </div>
  );
}
