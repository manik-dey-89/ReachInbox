import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PaginatedResponse } from '@/types';

export interface EmailRow {
  id: string;
  campaignId: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  status: string;
  scheduledFor: string | null;
  processedAt: string | null;
  sentAt: string | null;
  lastError: string | null;
  previewUrl: string | null;
}

interface UseEmailsParams {
  view: 'scheduled' | 'sent' | 'failed';
  page?: number;
  pageSize?: number;
  q?: string;
}

async function fetchEmails(params: UseEmailsParams): Promise<PaginatedResponse<EmailRow>> {
  const res = await api.get<{ data: PaginatedResponse<EmailRow> }>('/api/emails', { params });
  return res.data.data!;
}

export function useEmails(params: UseEmailsParams) {
  const query = useQuery<PaginatedResponse<EmailRow>>({
    queryKey: ['emails', params],
    queryFn: () => fetchEmails(params),
  });

  return {
    emails: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
