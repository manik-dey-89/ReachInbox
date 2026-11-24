'use client';

import { useState } from 'react';
import { useJobs } from '@/hooks/useJobs';
import { EmailTable, type Column } from '@/components/emails/EmailTable';
import { StatusBadge } from '@/components/emails/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { EmailJob } from '@/types';
import toast from 'react-hot-toast';

type JobRow = Record<string, unknown> & EmailJob;

export default function FailedPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { jobs, isLoading, error, retryJob } = useJobs({
    status: 'FAILED',
    page,
    pageSize,
  }) as { jobs: { data: EmailJob[]; total: number } | undefined; isLoading: boolean; error: Error | null; retryJob: (id: string) => void };

  function handleRetry(id: string) {
    retryJob(id);
    toast.success('Retry queued');
  }

  const columns: Column<JobRow>[] = [
    {
      key: 'recipientId',
      header: 'Recipient',
      render: (row) => <span className="font-mono text-xs">{String(row.recipientId).slice(0, 8)}…</span>,
    },
    {
      key: 'campaignId',
      header: 'Campaign',
      render: (row) => <span className="font-mono text-xs">{String(row.campaignId).slice(0, 8)}…</span>,
    },
    {
      key: 'lastError',
      header: 'Failure Reason',
      render: (row) => (
        <span className="text-red-600 dark:text-red-400 text-xs">
          {row.lastError ? String(row.lastError) : 'Unknown error'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Failed At',
      render: (row) =>
        row.updatedAt
          ? formatDate(
              row.updatedAt instanceof Date
                ? row.updatedAt.toISOString()
                : String(row.updatedAt),
            )
          : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={String(row.status)} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRetry(String(row.id))}
        >
          Retry
        </Button>
      ),
    },
  ];

  if (error) {
    return <ErrorState message="Failed to load failed jobs." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Failed Emails</h1>

      <EmailTable<JobRow>
        columns={columns}
        data={(jobs?.data ?? []) as JobRow[]}
        isLoading={isLoading}
        emptyMessage="No failed jobs — great work!"
      />

      {!isLoading && jobs && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={jobs.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
