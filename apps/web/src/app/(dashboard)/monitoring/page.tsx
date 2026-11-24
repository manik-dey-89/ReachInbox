'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Zap, Timer, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
}

async function fetchQueueStats(): Promise<QueueStats> {
  const res = await api.get<{ success: boolean; data: QueueStats }>('/api/health/queues');
  if (!res.data?.data) throw new Error('Invalid response');
  return res.data.data;
}

const STAT_CARDS = [
  { key: 'waiting' as const, label: 'Waiting', icon: Clock, color: 'text-yellow-500' },
  { key: 'active' as const, label: 'Active', icon: Zap, color: 'text-blue-500' },
  { key: 'delayed' as const, label: 'Delayed', icon: Timer, color: 'text-purple-500' },
  { key: 'completed' as const, label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
  { key: 'failed' as const, label: 'Failed', icon: XCircle, color: 'text-red-500' },
];

export default function MonitoringPage() {
  const { data: stats, isLoading, error, refetch } = useQuery<QueueStats>({
    queryKey: ['health', 'queues'],
    queryFn: fetchQueueStats,
    refetchInterval: 5000,
    retry: 2,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Queue Monitoring</h1>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {isLoading ? '—' : (stats?.[key] ?? 0).toLocaleString()}
                  </p>
                </div>
                <Icon className={`h-8 w-8 ${color} opacity-80`} />
              </div>
              {error && !isLoading && (
                <p className="text-xs text-red-500 mt-1">Could not load</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bull Board */}
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
