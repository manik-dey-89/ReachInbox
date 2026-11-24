import { Badge } from '@/components/ui/badge';
import { JobStatus, CampaignStatus, RecipientStatus } from '@/types';

type AnyStatus = JobStatus | CampaignStatus | RecipientStatus | string;

interface StatusConfig {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const statusMap: Record<string, StatusConfig> = {
  // JobStatus
  [JobStatus.PENDING]: { label: 'Pending', variant: 'warning' },
  [JobStatus.PROCESSING]: { label: 'Processing', variant: 'info' },
  [JobStatus.COMPLETED]: { label: 'Completed', variant: 'success' },
  [JobStatus.FAILED]: { label: 'Failed', variant: 'error' },
  [JobStatus.RATE_LIMITED]: { label: 'Rate Limited', variant: 'warning' },
  [JobStatus.CANCELLED]: { label: 'Cancelled', variant: 'default' },

  // CampaignStatus extras
  [CampaignStatus.DRAFT]: { label: 'Draft', variant: 'default' },
  [CampaignStatus.SCHEDULED]: { label: 'Scheduled', variant: 'info' },
  [CampaignStatus.SENDING]: { label: 'Sending', variant: 'info' },
  [CampaignStatus.PAUSED]: { label: 'Paused', variant: 'warning' },

  // RecipientStatus extras
  [RecipientStatus.SENT]: { label: 'Sent', variant: 'success' },
};

interface StatusBadgeProps {
  status: AnyStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] ?? { label: status, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
