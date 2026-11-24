import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { RateLimitStatus } from '@/types';

async function fetchRateLimitStatus(): Promise<RateLimitStatus> {
  const res = await api.get<{ data: RateLimitStatus }>('/api/rate-limits/status');
  return res.data.data!;
}

export function useRateLimits() {
  return useQuery<RateLimitStatus>({
    queryKey: ['rate-limits', 'status'],
    queryFn: fetchRateLimitStatus,
    refetchInterval: 10_000,
  });
}
