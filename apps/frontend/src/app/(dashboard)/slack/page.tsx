'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSlack } from '@/hooks/useSlack';
import { SlackStatus } from '@/components/slack/SlackStatus';
import { SlackConnectButton } from '@/components/slack/SlackConnectButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/modal';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SlackPage() {
  const { status, isLoading, disconnect, isDisconnecting, refetch } = useSlack();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const searchParams = useSearchParams();

  // Handle OAuth callback result from query params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === 'true') {
      toast.success('Slack connected successfully!');
      void refetch?.();
      // Clean up URL
      window.history.replaceState({}, '', '/slack');
    } else if (error) {
      toast.error(`Slack connection failed: ${decodeURIComponent(error)}`);
      window.history.replaceState({}, '', '/slack');
    }
  }, [searchParams, refetch]);

  const isConnected = status?.connected && status.integration;

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Slack Integration</h1>

      <SlackStatus
        integration={status?.integration ?? null}
        isLoading={isLoading}
        onDisconnect={isConnected ? () => setConfirmDisconnect(true) : undefined}
        isDisconnecting={isDisconnecting}
      />

      {!isLoading && !isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Connect your workspace</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect Slack to receive real-time notifications about your email campaigns directly in your Slack workspace.
            </p>
            <SlackConnectButton />
          </CardContent>
        </Card>
      )}

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Team info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="text-sm space-y-2">
              <div className="flex gap-3">
                <dt className="text-slate-500 dark:text-slate-400 w-28">Team name</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{status!.integration!.teamName}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-slate-500 dark:text-slate-400 w-28">Team ID</dt>
                <dd className="font-mono text-slate-700 dark:text-slate-300">{status!.integration!.teamId}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Notifications info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <CardTitle>Notification events</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 list-disc list-inside">
            <li>Global rate limit reached</li>
            <li>Per-sender rate limit reached</li>
            <li>Campaign completed</li>
            <li>High failure rate detected</li>
          </ul>
        </CardContent>
      </Card>

      {/* Disconnect confirmation modal */}
      <Modal open={confirmDisconnect} onOpenChange={(open) => !open && setConfirmDisconnect(false)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Disconnect Slack</ModalTitle>
          </ModalHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to disconnect Slack? You will stop receiving campaign notifications in Slack.
          </p>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={isDisconnecting}
              onClick={() => {
                disconnect();
                setConfirmDisconnect(false);
              }}
            >
              Disconnect
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
