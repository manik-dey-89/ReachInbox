'use client';

import { useState, useMemo } from 'react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { EmailTable, type Column } from '@/components/emails/EmailTable';
import { EmailSearch } from '@/components/emails/EmailSearch';
import { StatusBadge } from '@/components/emails/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { ErrorState } from '@/components/common/ErrorState';
import { formatDate } from '@/lib/utils';
import type { EmailCampaign } from '@/types';

type CampaignRow = Record<string, unknown> & EmailCampaign;

const columns: Column<CampaignRow>[] = [
  { key: 'id', header: 'Campaign ID', render: (row) => <span className="font-mono text-xs">{String(row.id).slice(0, 8)}…</span> },
  { key: 'subject', header: 'Subject' },
  {
    key: 'scheduledAt',
    header: 'Scheduled Time',
    render: (row) =>
      row.scheduledAt
        ? formatDate(
            row.scheduledAt instanceof Date
              ? row.scheduledAt.toISOString()
              : String(row.scheduledAt),
          )
        : '—',
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={String(row.status)} />,
  },
  {
    key: 'totalRecipients',
    header: 'Recipients',
    render: (row) => Number(row.totalRecipients).toLocaleString(),
  },
];

export default function ScheduledPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const { campaigns, isLoading, error, refetch } = useCampaigns({
    status: 'SCHEDULED',
    page,
    pageSize,
  }) as { campaigns: { items: EmailCampaign[]; total: number } | undefined; isLoading: boolean; error: Error | null; refetch?: () => void };

  const filtered = useMemo(() => {
    if (!campaigns?.items) return [];
    if (!search.trim()) return campaigns.items;
    const q = search.toLowerCase();
    return campaigns.items.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [campaigns?.items, search]);

  if (error) {
    return (
      <ErrorState
        message="Failed to load scheduled campaigns."
        retry={() => refetch?.()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scheduled Emails</h1>

      <EmailSearch
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search by subject or campaign ID…"
      />

      <EmailTable<CampaignRow>
        columns={columns}
        data={filtered as CampaignRow[]}
        isLoading={isLoading}
        emptyMessage="No scheduled campaigns found."
      />

      {!isLoading && campaigns && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={campaigns.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
