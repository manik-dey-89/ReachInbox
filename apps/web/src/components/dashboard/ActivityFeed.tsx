import { Activity, Mail, AlertTriangle, CheckCircle, XCircle, LogIn, LogOut, Zap, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { formatRelativeTime } from '@/lib/utils';
import type { RecentActivityItem } from '@/types';

function getActivityIcon(type: string) {
  switch (type) {
    case 'CAMPAIGN_CREATED':
    case 'CAMPAIGN_SCHEDULED':
      return <Mail className="h-4 w-4 text-indigo-500" />;
    case 'CAMPAIGN_CANCELLED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'EMAIL_SENT':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'EMAIL_FAILED':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'USER_LOGIN':
      return <LogIn className="h-4 w-4 text-blue-500" />;
    case 'USER_LOGOUT':
      return <LogOut className="h-4 w-4 text-slate-400" />;
    case 'SLACK_CONNECTED':
    case 'SLACK_DISCONNECTED':
      return <Zap className="h-4 w-4 text-yellow-500" />;
    case 'SENDER_CREATED':
      return <Settings className="h-4 w-4 text-indigo-400" />;
    case 'RATE_LIMIT_HIT':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    default:
      return <Activity className="h-4 w-4 text-slate-400" />;
  }
}

interface ActivityFeedProps {
  activities: RecentActivityItem[];
  isLoading?: boolean;
}

export function ActivityFeed({ activities, isLoading = false }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Activity will appear here as you send campaigns."
          />
        ) : (
          <div className="max-h-80 overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {activities.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  {getActivityIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
                    {item.message}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {formatRelativeTime(
                      item.timestamp instanceof Date
                        ? item.timestamp.toISOString()
                        : String(item.timestamp),
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
