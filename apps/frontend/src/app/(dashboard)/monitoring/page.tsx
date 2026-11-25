'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/modal';
import { Clock, Zap, Timer, CheckCircle, XCircle, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

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

async function drainQueue(state: string): Promise<{ message: string; data: QueueStats }> {
  const res = await api.delete<{ success: boolean; message: string; data: QueueStats }>(
    `/api/health/queues/${state}`
  );
  return res.data as { message: string; data: QueueStats };
}

const STAT_CARDS = [
  { key: 'waiting' as const,   label: 'Waiting',   icon: Clock,        color: 'text-yellow-500', drainKey: 'wait',      canDelete: true  },
  { key: 'active' as const,    label: 'Active',    icon: Zap,          color: 'text-blue-500',   drainKey: null,        canDelete: false },
  { key: 'delayed' as const,   label: 'Delayed',   icon: Timer,        color: 'text-purple-500', drainKey: 'delayed',   canDelete: true  },
  { key: 'completed' as const, label: 'Completed', icon: CheckCircle,  color: 'text-green-500',  drainKey: 'completed', canDelete: true  },
  { key: 'failed' as const,    label: 'Failed',    icon: XCircle,      color: 'text-red-500',    drainKey: 'failed',    canDelete: true  },
];

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [confirmState, setConfirmState] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: stats, isLoading, error, refetch } = useQuery<QueueStats>({
    queryKey: ['health', 'queues'],
    queryFn: fetchQueueStats,
    refetchInterval: 5000,
    retry: 2,
  });

  async function handleDelete(drainKey: string) {
    setDeleting(true);
    try {
      const result = await drainQueue(drainKey);
      toast.success(result.message);
      // Update queue stats immediately with returned counts
      queryClient.setQueryData(['health', 'queues'], result.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete jobs';
      toast.error(msg);
    } finally {
      setDeleting(false);
      setConfirmState(null);
    }
  }

  const confirmCard = STAT_CARDS.find((c) => c.drainKey === confirmState);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Queue Monitoring</h1>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Stats cards with delete buttons */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, drainKey, canDelete }) => (
          <Card key={key} className="relative">
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
              {canDelete && drainKey && (
                <button
                  onClick={() => setConfirmState(drainKey)}
                  disabled={isLoading || (stats?.[key] ?? 0) === 0}
                  title={`Delete all ${label.toLowerCase()} jobs`}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 rounded-md py-1.5 px-2"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete {label}
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bull Board — opened in a new tab instead of an iframe.
          The iframe is unreliable in production: the backend lives on a
          different origin, and browsers block third-party cookies inside
          cross-origin iframes, so the admin session cookie never reaches
          the backend and Bull Board shows "UNAUTHENTICATED". */}
      <Card>
        <CardHeader>
          <CardTitle>Bull Board</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Bull Board runs on the backend domain and needs your admin session,
            so it opens in a new tab. Your login session carries over.
          </p>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/queues`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            <ExternalLink className="h-4 w-4" />
            Open Bull Board
          </a>
          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open via app proxy (use if the direct link fails)
          </a>
        </CardContent>
      </Card>

      {/* Confirmation modal */}
      <Modal open={!!confirmState} onOpenChange={(open) => !open && setConfirmState(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Delete {confirmCard?.label} Jobs</ModalTitle>
          </ModalHeader>
          <div className="px-6 pb-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This will permanently remove all{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {stats && confirmCard ? (stats[confirmCard.key] ?? 0).toLocaleString() : '—'}
              </span>{' '}
              <span className={confirmCard?.color ?? ''}>{confirmCard?.label.toLowerCase()}</span> jobs
              from the queue. This action cannot be undone.
            </p>
          </div>
          <ModalFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmState(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleting}
              onClick={() => confirmState && void handleDelete(confirmState)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete All
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
