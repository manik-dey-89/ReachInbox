import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EmailJob, PaginatedResponse } from '@/types';

interface JobsParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

async function fetchJobs(params: JobsParams): Promise<PaginatedResponse<EmailJob>> {
  const res = await api.get<{ data: PaginatedResponse<EmailJob> }>('/api/jobs', { params });
  return res.data.data!;
}

async function retryJob(id: string): Promise<EmailJob> {
  const res = await api.post<{ data: EmailJob }>(`/api/jobs/${id}/retry`);
  return res.data.data!;
}

export function useJobs(params: JobsParams = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery<PaginatedResponse<EmailJob>>({
    queryKey: ['jobs', params],
    queryFn: () => fetchJobs(params),
  });

  const retryMutation = useMutation<EmailJob, Error, string>({
    mutationFn: retryJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  return {
    jobs: listQuery.data,
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    retryJob: retryMutation.mutate,
    retryJobAsync: retryMutation.mutateAsync,
    isRetrying: retryMutation.isPending,
  };
}
