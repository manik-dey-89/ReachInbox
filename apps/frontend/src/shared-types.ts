import { JobStatus, DeliveryStatus, CampaignStatus, RecipientStatus, OAuthProvider, AuditAction } from './shared-enums';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export interface SenderAccount {
  id: string;
  userId: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  createdAt: Date;
}

export interface EmailCampaign {
  id: string;
  userId: string;
  senderAccountId: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailRecipient {
  id: string;
  campaignId: string;
  email: string;
  name: string | null;
  status: RecipientStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  jobId: string | null;
  createdAt: Date;
}

export interface EmailJob {
  id: string;
  recipientId: string;
  campaignId: string;
  bullJobId: string;
  status: JobStatus;
  attempt: number;
  lastError: string | null;
  scheduledFor: Date;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailDeliveryLog {
  id: string;
  emailJobId: string;
  recipientId: string;
  campaignId: string;
  status: DeliveryStatus;
  smtpMessageId: string | null;
  smtpResponse: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface SlackIntegration {
  id: string;
  userId: string;
  teamId: string;
  teamName: string;
  botToken: string;
  webhookUrl: string | null;
  connectedAt: Date;
  disconnectedAt: Date | null;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface RateLimitCounter {
  key: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
}

// API Request/Response types
export interface CreateCampaignRequest {
  senderAccountId: string;
  subject: string;
  body: string;
  recipients: RecipientInput[];
  scheduledAt: string;
  delayBetweenMs: number;
  hourlyLimit?: number;
}

export interface RecipientInput {
  email: string;
  name?: string;
}

export interface ScheduleCampaignRequest {
  campaignId: string;
}

export interface CreateSenderRequest {
  name: string;
  email: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  useEthereal?: boolean;
}

export interface SearchEmailsRequest {
  query?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchEmailsResponse {
  hits: EmailSearchDocument[];
  total: number;
  page: number;
  pageSize: number;
  degraded?: boolean;
}

export interface EmailSearchDocument {
  id: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
}

export interface DashboardStats {
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  hourlyUsage: {
    global: number;
    limit: number;
  };
  recentActivity: RecentActivityItem[];
  senderStats: SenderStat[];
}

export interface RecentActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface SenderStat {
  senderId: string;
  senderName: string;
  senderEmail: string;
  sent: number;
  failed: number;
  pending: number;
  hourlyUsage: number;
  hourlyLimit: number;
}

export interface RateLimitStatus {
  global: {
    current: number;
    limit: number;
    remaining: number;
    resetsAt: string;
  };
  senders: Array<{
    senderId: string;
    current: number;
    limit: number;
    remaining: number;
    resetsAt: string;
  }>;
}

// Queue job payload types
export interface EmailJobPayload {
  jobId: string;
  recipientId: string;
  campaignId: string;
  userId: string;
  senderAccountId: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  body: string;
  attempt: number;
  idempotencyKey: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
