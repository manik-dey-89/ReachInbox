// Re-export everything from @reachinbox/shared
export * from '@reachinbox/shared';

// Frontend-specific types

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchResult {
  id: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  degraded?: boolean;
}

export interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}
