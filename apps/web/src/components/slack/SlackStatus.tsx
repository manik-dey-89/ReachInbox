import { CheckCircle, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

interface SlackIntegrationSummary {
  id: string;
  teamId: string;
  teamName: string;
  connectedAt: string | Date;
}

interface SlackStatusProps {
  integration: SlackIntegrationSummary | null;
  isLoading?: boolean;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
}

export function SlackStatus({ integration, isLoading = false, onDisconnect, isDisconnecting }: SlackStatusProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (integration) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Connected to {integration.teamName}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Connected{' '}
                  {formatDate(
                    integration.connectedAt instanceof Date
                      ? integration.connectedAt.toISOString()
                      : String(integration.connectedAt),
                  )}
                </p>
              </div>
            </div>
            {onDisconnect && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onDisconnect}
                loading={isDisconnecting}
              >
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Circle className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Not connected</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect Slack to receive notifications about your campaigns.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
