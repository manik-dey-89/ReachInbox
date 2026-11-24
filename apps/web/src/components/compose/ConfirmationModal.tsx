'use client';

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface ConfirmationSummary {
  recipientCount: number;
  subject: string;
  senderEmail: string;
  scheduledAt: string;
  delayBetweenMs: number;
  hourlyLimit: number;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  summary: ConfirmationSummary;
}

function formatDelay(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${ms / 1000}s`;
  return `${ms / 60000}min`;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  summary,
}: ConfirmationModalProps) {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Confirm Campaign</ModalTitle>
        </ModalHeader>

        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr>
              <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400 w-1/3">Recipients</td>
              <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                {summary.recipientCount.toLocaleString()} email{summary.recipientCount !== 1 ? 's' : ''}
              </td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">Subject</td>
              <td className="py-2.5 font-medium text-slate-900 dark:text-white truncate max-w-xs">
                {summary.subject}
              </td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">Sender</td>
              <td className="py-2.5 font-medium text-slate-900 dark:text-white">{summary.senderEmail}</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">Scheduled at</td>
              <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                {formatDate(summary.scheduledAt)}
              </td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">Delay</td>
              <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                {formatDelay(summary.delayBetweenMs)}
              </td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">Hourly limit</td>
              <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                {summary.hourlyLimit} / hour
              </td>
            </tr>
          </tbody>
        </table>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={isLoading}>
            Schedule {summary.recipientCount} email{summary.recipientCount !== 1 ? 's' : ''}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
