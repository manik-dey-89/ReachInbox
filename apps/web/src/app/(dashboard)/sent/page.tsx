'use client';

import { useState } from 'react';
import { useEmails, type EmailRow } from '@/hooks/useEmails';
import { EmailTable, type Column } from '@/components/emails/EmailTable';
import { EmailSearch } from '@/components/emails/EmailSearch';
import { StatusBadge } from '@/components/emails/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { ErrorState } from '@/components/common/ErrorState';
import { formatDate } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

type EmailRowRecord = Record<string, unknown> & EmailRow;

const columns: Column<EmailRowRecord>[] = [
  {
    key: 'recipientEmail',
    header: 'Recipient Email',
    render: (row) => (
      <span className="font-mono text-sm">{String(row.recipientEmail)}</span>
    ),
  },
  { key: 'subject', header: 'Subject' },
  {
    key: 'sentAt',
    header: 'Sent Time',
    render: (row) =>
      row.sentAt
        ? formatDate(String(row.sentAt))
        : row.processedAt
          ? formatDate(String(row.processedAt))
          : '—',
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={String(row.status)} />,
  },
  {
    key: 'previewUrl',
    header: 'Preview',
    render: (row) => {
      const url = row.previewUrl as string | null;
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

  const { emails, isLoading, error, refetch } = useEmails({
    view: 'sent',
    page,
    pageSize,
    q: search || undefined,
  });

  if (error) {
    return <ErrorState message="Failed to load sent emails." retry={() => refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sent Emails</h1>

      <EmailSearch
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search by recipient email or subject…"
      />

      <EmailTable<EmailRowRecord>
        columns={columns}
        data={(emails?.items ?? []) as EmailRowRecord[]}
        isLoading={isLoading}
        emptyMessage="No sent emails found."
      />

      {!isLoading && emails && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={emails.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
