'use client';

import { useState } from 'react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { EmailTable, type Column } from '@/components/emails/EmailTable';
import { EmailSearch } from '@/components/emails/EmailSearch';
import { StatusBadge } from '@/components/emails/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { ErrorState } from '@/components/common/ErrorState';
import { formatDate } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import type { EmailCampaign } from '@/types';

interface DeliveryLog {
  id: string;
  smtpResponse: string | null;
  smtpMessageId: string | null;
  sentAt: string | null;
  recipientId: string;
}

type CampaignWithLogs = EmailCampaign & {
  deliveryLogs?: DeliveryLog[];
  recipients?: Array<{ id: string; email: string; name: string | null; status: string }>;
};

type CampaignRow = Record<string, unknown> & CampaignWithLogs;

function getFirstPreviewUrl(row: CampaignRow): string | null {
  const logs = row.deliveryLogs as DeliveryLog[] | undefined;
  if (!logs || logs.length === 0) return null;
  for (const log of logs) {
    if (log.smtpResponse && log.smtpResponse.startsWith('http')) {
      return log.smtpResponse;
    }
  }
  return null;
}

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
  {
    key: 'preview',
    header: 'Preview',
    render: (row) => {
      const url = getFirstPreviewUrl(row);
      if (!url) return <span className="text-slate-400 text-xs">—</span>;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
        >
          <ExternalLink className="h-3 w-3" />
          Ethereal
        </a>
      );
    },
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
  }) as { campaigns: { items: CampaignWithLogs[]; total: number } | undefined; isLoading: boolean; error: Error | null; refetch?: () => void };

  const filtered = (() => {
    if (!campaigns?.items) return [];
    if (!search.trim()) return campaigns.items;
    const q = search.toLowerCase();
    return campaigns.items.filter(
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
