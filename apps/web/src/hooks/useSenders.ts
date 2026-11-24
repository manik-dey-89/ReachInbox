import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SenderAccount, CreateSenderRequest } from '@/types';

async function fetchSenders(): Promise<SenderAccount[]> {
  const res = await api.get<{ data: SenderAccount[] }>('/api/senders');
  return res.data.data ?? [];
}

async function createSender(payload: CreateSenderRequest): Promise<SenderAccount> {
  const res = await api.post<{ data: SenderAccount }>('/api/senders', payload);
  return res.data.data!;
}

export function useSenders() {
  const queryClient = useQueryClient();

  const listQuery = useQuery<SenderAccount[]>({
    queryKey: ['senders'],
    queryFn: fetchSenders,
  });

  const createMutation = useMutation<SenderAccount, Error, CreateSenderRequest>({
    mutationFn: createSender,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
  });

  return {
    senders: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    createSender: createMutation.mutate,
    createSenderAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
