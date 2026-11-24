import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SlackIntegration } from '@/types';

interface SlackStatus {
  connected: boolean;
  integration: SlackIntegration | null;
}

async function fetchSlackStatus(): Promise<SlackStatus> {
  const res = await api.get<{ data: SlackStatus }>('/api/slack/status');
  return res.data.data!;
}

async function disconnectSlack(): Promise<void> {
  await api.delete('/api/slack/disconnect');
}

export function useSlack() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery<SlackStatus>({
    queryKey: ['slack', 'status'],
    queryFn: fetchSlackStatus,
  });

  const disconnectMutation = useMutation<void, Error, void>({
    mutationFn: disconnectSlack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack'] });
    },
  });

  function connect() {
    window.location.href = '/api/slack/connect';
  }

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    error: statusQuery.error,
    connect,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  };
}
