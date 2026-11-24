// Local copies of shared types (inlined for Render isolated build compatibility)
export * from '../shared-enums';
export * from '../shared-types';

// Frontend-specific types — matches backend PaginatedResponse shape
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
