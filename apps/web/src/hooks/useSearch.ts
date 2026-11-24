import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SearchResult } from '@/types';

interface SearchParams {
  q: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
}

async function searchEmails(params: SearchParams): Promise<{ hits: SearchResult[]; total: number; page: number; pageSize: number; degraded?: boolean }> {
  const res = await api.get<{ data: { hits: SearchResult[]; total: number; page: number; pageSize: number; degraded?: boolean } }>('/api/search/emails', {
    params: {
      query: params.q,
      status: params.status,
      dateFrom: params.from,
      dateTo: params.to,
      page: params.page,
    },
  });
  return res.data.data!;
}

export function useSearch(params: SearchParams) {
  return useQuery<{ hits: SearchResult[]; total: number; page: number; pageSize: number; degraded?: boolean }>({
    queryKey: ['search', 'emails', params],
    queryFn: () => searchEmails(params),
    enabled: params.q.length > 0,
  });
}
