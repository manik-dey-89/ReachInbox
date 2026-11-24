'use client';

import { useState, useRef } from 'react';
import { useSearch } from '@/hooks/useSearch';
import { EmailTable, type Column } from '@/components/emails/EmailTable';
import { EmailSearch } from '@/components/emails/EmailSearch';
import { StatusBadge } from '@/components/emails/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { SearchResult } from '@/types';

type SearchRow = Record<string, unknown> & SearchResult;

const STATUS_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Rate Limited', value: 'RATE_LIMITED' },
];

const columns: Column<SearchRow>[] = [
  { key: 'recipientEmail', header: 'Recipient' },
  { key: 'subject', header: 'Subject' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={String(row.status)} />,
  },
  {
    key: 'sentAt',
    header: 'Date',
    render: (row) => {
      const date = row.sentAt ?? row.scheduledAt;
      return date ? formatDate(String(date)) : '—';
    },
  },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      setPage(1);
    }, 400);
  }

  const { data, isLoading } = useSearch({
    q: debouncedQuery,
    status: status !== 'all' ? status : undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    page,
  });

  const isDegraded = data?.degraded === true;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Search Emails</h1>

      <EmailSearch
        value={query}
        onChange={handleQueryChange}
        placeholder="Search by recipient, subject, campaign ID…"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateFrom">From</Label>
          <input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateTo">To</Label>
          <input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {isDegraded && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
          Search degraded — showing database results
        </div>
      )}

      {!debouncedQuery ? (
        <EmptyState
          icon={Search}
          title="Search emails"
          description="Enter a search term to find emails across all campaigns."
        />
      ) : (
        <>
          <EmailTable<SearchRow>
            columns={columns}
            data={(data?.hits ?? []) as SearchRow[]}
            isLoading={isLoading}
            emptyMessage="No emails match your search."
          />

          {!isLoading && data && (
            <Pagination
              page={page}
              pageSize={10}
              total={data.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <div className="flex justify-end">
        <span className="text-xs text-slate-400 dark:text-slate-500 italic">
          Search powered by Elasticsearch
        </span>
      </div>
    </div>
  );
}
