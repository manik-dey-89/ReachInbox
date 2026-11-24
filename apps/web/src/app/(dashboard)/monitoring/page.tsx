'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Zap, Timer, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import type { QueueStats } from '@/types';

async function fetchQueueStats(): Promise<QueueStats> {
  const res = await api.get<{ data: QueueStats }>('/api/health/queues');
  return res.data.data!;
}

export default function MonitoringPage() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading, error } = useQuery<QueueStats>({
    queryKey: ['health', 'queues'],
    queryFn: fetchQueueStats,
    refetchInterval: 5000,
  });

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['health', 'queues'] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Queue Monitoring</h1>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {error ? (
        <ErrorState
          message="Failed to load queue statistics."
          retry={handleRefresh}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatsCard
            title="Waiting"
            value={isLoading ? '—' : (stats?.waiting ?? 0).toLocaleString()}
            icon={Clock}
            isLoading={isLoading}
          />
          <StatsCard
            title="Active"
            value={isLoading ? '—' : (stats?.active ?? 0).toLocaleString()}
            icon={Zap}
            isLoading={isLoading}
          />
          <StatsCard
            title="Delayed"
            value={isLoading ? '—' : (stats?.delayed ?? 0).toLocaleString()}
            icon={Timer}
            isLoading={isLoading}
          />
          <StatsCard
            title="Completed"
            value={isLoading ? '—' : (stats?.completed ?? 0).toLocaleString()}
            icon={CheckCircle}
            isLoading={isLoading}
          />
          <StatsCard
            title="Failed"
            value={isLoading ? '—' : (stats?.failed ?? 0).toLocaleString()}
            icon={XCircle}
            isLoading={isLoading}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Bull Board</CardTitle>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in new tab
            </a>
          </div>
        </CardHeader>
        <CardContent>
          <iframe
            src="/admin/queues"
            title="Bull Board Queue Monitor"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
            style={{ height: 600 }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
