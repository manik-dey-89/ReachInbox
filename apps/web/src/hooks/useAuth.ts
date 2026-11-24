import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

async function fetchMe(): Promise<User | null> {
  try {
    const res = await api.get<{ data: User }>('/api/auth/me');
    return res.data.data ?? null;
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number } };
    if (axiosError.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export function useAuth(): AuthState {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
  };
}
