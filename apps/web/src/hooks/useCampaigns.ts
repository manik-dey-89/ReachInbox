import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EmailCampaign, CreateCampaignRequest, PaginatedResponse } from '@/types';

interface ListCampaignsParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

async function fetchCampaigns(params: ListCampaignsParams): Promise<PaginatedResponse<EmailCampaign>> {
  const res = await api.get<{ data: PaginatedResponse<EmailCampaign> }>('/api/campaigns', { params });
  return res.data.data!;
}

async function createCampaign(payload: CreateCampaignRequest): Promise<EmailCampaign> {
  const res = await api.post<{ data: EmailCampaign }>('/api/campaigns', payload);
  return res.data.data!;
}

async function scheduleCampaign(id: string): Promise<EmailCampaign> {
  const res = await api.post<{ data: EmailCampaign }>(`/api/campaigns/${id}/schedule`);
  return res.data.data!;
}

export function useCampaigns(params: ListCampaignsParams = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery<PaginatedResponse<EmailCampaign>>({
    queryKey: ['campaigns', params],
    queryFn: () => fetchCampaigns(params),
  });

  const createMutation = useMutation<EmailCampaign, Error, CreateCampaignRequest>({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const scheduleMutation = useMutation<EmailCampaign, Error, string>({
    mutationFn: scheduleCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  return {
    campaigns: listQuery.data,
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    createCampaign: createMutation.mutate,
    createCampaignAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    scheduleCampaign: scheduleMutation.mutate,
    scheduleCampaignAsync: scheduleMutation.mutateAsync,
    isScheduling: scheduleMutation.isPending,
  };
}
