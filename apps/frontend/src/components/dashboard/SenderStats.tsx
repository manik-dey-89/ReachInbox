import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Users } from 'lucide-react';
import type { SenderStat } from '@/types';

interface SenderStatsProps {
  senders: SenderStat[];
  isLoading?: boolean;
}

export function SenderStats({ senders, isLoading = false }: SenderStatsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sender Accounts</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : senders.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No senders yet"
            description="Add a sender account to start sending campaigns."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Hourly Usage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {senders.map((sender) => (
                <TableRow key={sender.senderId}>
                  <TableCell className="font-medium">{sender.senderName}</TableCell>
                  <TableCell>{sender.senderEmail}</TableCell>
                  <TableCell className="text-green-600 dark:text-green-400">{sender.sent}</TableCell>
                  <TableCell className="text-red-600 dark:text-red-400">{sender.failed}</TableCell>
                  <TableCell>
                    <span className="text-slate-700 dark:text-slate-300">
                      {sender.hourlyUsage}
                      <span className="text-slate-400"> / {sender.hourlyLimit}</span>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
