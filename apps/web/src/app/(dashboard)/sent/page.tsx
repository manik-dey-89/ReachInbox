'use client';

import { useState } from 'react';
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
    key: 'completedAt',
    header: 'Sent Time',
    render: (row) =>
      row.completedAt
        ? formatDate(
            row.completedAt instanceof Date
              ? row.completedAt.toISOString()
              : String(row.completedAt),
          )
        : '—',
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={String(row.status)} />,
  },
  {
    key: 'sentCount',
    header: 'Sent',
    render: (row) => `${Number(row.sentCount)} / ${Number(row.totalRecipients)}`,
  },
];

export default function SentPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const { campaigns, isLoading, error, refetch } = useCampaigns({
    status: 'COMPLETED',
    page,
    pageSize,
  }) as { campaigns: { data: EmailCampaign[]; total: number } | undefined; isLoading: boolean; error: Error | null; refetch?: () => void };

  const filtered = (() => {
    if (!campaigns?.data) return [];
    if (!search.trim()) return campaigns.data;
    const q = search.toLowerCase();
    return campaigns.data.filter(
      (c) => c.subject.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  })();

  if (error) {
    return <ErrorState message="Failed to load sent campaigns." retry={() => refetch?.()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sent Emails</h1>

      <EmailSearch
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search by subject or campaign ID…"
      />

      <EmailTable<CampaignRow>
        columns={columns}
        data={filtered as CampaignRow[]}
        isLoading={isLoading}
        emptyMessage="No completed campaigns found."
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
