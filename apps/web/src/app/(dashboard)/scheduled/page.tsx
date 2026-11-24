'use client';

import { useState } from 'react';
import { useEmails, type EmailRow } from '@/hooks/useEmails';
import { EmailTable, type Column } from '@/components/emails/EmailTable';
import { EmailSearch } from '@/components/emails/EmailSearch';
import { StatusBadge } from '@/components/emails/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { ErrorState } from '@/components/common/ErrorState';
import { formatDate } from '@/lib/utils';

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
    key: 'scheduledFor',
    header: 'Scheduled Time',
    render: (row) =>
      row.scheduledFor
        ? formatDate(String(row.scheduledFor))
        : '—',
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={String(row.status)} />,
  },
];

export default function ScheduledPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const { emails, isLoading, error, refetch } = useEmails({
    view: 'scheduled',
    page,
    pageSize,
    q: search || undefined,
  });

  if (error) {
    return (
      <ErrorState
        message="Failed to load scheduled emails."
        retry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scheduled Emails</h1>

      <EmailSearch
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search by recipient email or subject…"
      />

      <EmailTable<EmailRowRecord>
        columns={columns}
        data={(emails?.items ?? []) as EmailRowRecord[]}
        isLoading={isLoading}
        emptyMessage="No scheduled emails found."
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
