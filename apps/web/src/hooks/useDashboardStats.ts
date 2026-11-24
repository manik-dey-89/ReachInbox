import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DashboardStats } from '@/types';

async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<{ data: DashboardStats }>('/api/dashboard/stats');
  return res.data.data!;
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30_000,
  });
}
