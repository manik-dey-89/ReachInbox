'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { composeEmailSchema, type ComposeEmailFormValues } from '@/lib/validations';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useSenders } from '@/hooks/useSenders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RecipientUploader } from './RecipientUploader';
import { ScheduleControls } from './ScheduleControls';
import { ConfirmationModal } from './ConfirmationModal';

function defaultScheduledAt(): string {
  return new Date(Date.now() + 5 * 60 * 1000).toISOString();
}

export function EmailComposer() {
  const router = useRouter();
  const { createCampaignAsync, scheduleCampaignAsync } = useCampaigns();
  const { senders, createSenderAsync, isCreating: isCreatingSender } = useSenders();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ComposeEmailFormValues>({
    resolver: zodResolver(composeEmailSchema),
    defaultValues: {
      subject: '',
      body: '',
      senderAccountId: '',
      recipients: [],
      scheduledAt: defaultScheduledAt(),
      delayBetweenMs: 1000,
      hourlyLimit: 50,
    },
  });

  const formValues = watch();

  async function handleConfirm() {
    setIsSending(true);
    try {
      const campaign = await createCampaignAsync({
        senderAccountId: formValues.senderAccountId,
        subject: formValues.subject,
        body: formValues.body,
        recipients: formValues.recipients
          .filter((r): r is { email: string; name?: string } => typeof r.email === 'string' && r.email.length > 0),
        scheduledAt: formValues.scheduledAt,
        delayBetweenMs: formValues.delayBetweenMs,
        hourlyLimit: formValues.hourlyLimit,
      });
      await scheduleCampaignAsync(campaign.id);
      toast.success('Campaign scheduled successfully!');
      router.push('/scheduled');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule campaign';
      toast.error(msg);
    } finally {
      setIsSending(false);
      setConfirmOpen(false);
    }
  }

  const selectedSender = senders.find((s) => s.id === formValues.senderAccountId);

  return (
    <>
      <form onSubmit={handleSubmit(() => setConfirmOpen(true))} noValidate>
        <div className="flex flex-col gap-6">
          {/* Subject */}
          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Input
                label="Subject"
                id="subject"
                placeholder="Enter email subject"
                error={errors.subject?.message}
                {...register('subject')}
              />
              <Textarea
                label="Body"
                id="body"
                placeholder="Write your email body here…"
                rows={8}
                error={errors.body?.message}
                {...register('body')}
              />
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle>Recipients</CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                name="recipients"
                control={control}
                render={({ field }) => (
                  <RecipientUploader onChange={field.onChange} />
                )}
              />
              {errors.recipients && (
                <p className="mt-1.5 text-xs text-red-500">{errors.recipients.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Sender */}
          <Card>
            <CardHeader>
              <CardTitle>Sender</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sender">Send from</Label>
                  <Controller
                    name="senderAccountId"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={senders.length === 0}>
                        <SelectTrigger
                          id="sender"
                          error={errors.senderAccountId?.message}
                        >
                          <SelectValue placeholder={senders.length === 0 ? 'No sender accounts — create one below' : 'Select a sender account'} />
                        </SelectTrigger>
                        <SelectContent>
                          {senders.map((sender) => (
                            <SelectItem key={sender.id} value={sender.id}>
                              {sender.name} &lt;{sender.email}&gt;
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.senderAccountId && (
                    <p className="text-xs text-red-500">{errors.senderAccountId.message}</p>
                  )}
                </div>

                {senders.length === 0 && (
                  <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 flex flex-col gap-3">
                    <div>
                      <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">No sender accounts yet</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                        Create a free Ethereal test sender to start sending emails immediately — no SMTP setup needed.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      loading={isCreatingSender}
                      onClick={async () => {
                        try {
                          await createSenderAsync({
                            name: 'Ethereal Test',
                            email: 'test@ethereal.email',
                            useEthereal: true,
                          } as Parameters<typeof createSenderAsync>[0]);
                          toast.success('Ethereal test sender created! Emails will show preview links.');
                        } catch {
                          toast.error('Failed to create sender');
                        }
                      }}
                    >
                      ✨ Create Free Ethereal Test Sender
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                name="scheduledAt"
                control={control}
                render={({ field: scheduledField }) => (
                  <Controller
                    name="delayBetweenMs"
                    control={control}
                    render={({ field: delayField }) => (
                      <Controller
                        name="hourlyLimit"
                        control={control}
                        render={({ field: limitField }) => (
                          <ScheduleControls
                            value={{
                              scheduledAt: scheduledField.value,
                              delayBetweenMs: delayField.value,
                              hourlyLimit: limitField.value,
                            }}
                            onChange={(v) => {
                              scheduledField.onChange(v.scheduledAt);
                              delayField.onChange(v.delayBetweenMs);
                              limitField.onChange(v.hourlyLimit);
                            }}
                          />
                        )}
                      />
                    )}
                  />
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg">
              Schedule Campaign
            </Button>
          </div>
        </div>
      </form>

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        isLoading={isSending}
        summary={{
          recipientCount: formValues.recipients.length,
          subject: formValues.subject,
          senderEmail: selectedSender?.email ?? '—',
          scheduledAt: formValues.scheduledAt,
          delayBetweenMs: formValues.delayBetweenMs,
          hourlyLimit: formValues.hourlyLimit,
        }}
      />
    </>
  );
}
