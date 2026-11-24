import { z } from 'zod';

export const composeEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  senderAccountId: z.string().uuid('Invalid sender account'),
  recipients: z
    .array(
      z.object({
        email: z.string().email('Invalid email address'),
        name: z.string().optional(),
      }),
    )
    .min(1, 'At least one recipient is required'),
  scheduledAt: z.string().datetime({ message: 'Invalid date/time' }),
  delayBetweenMs: z.number().min(0, 'Delay must be 0 or greater'),
  hourlyLimit: z
    .number()
    .min(1, 'Hourly limit must be at least 1')
    .max(1000, 'Hourly limit cannot exceed 1000'),
});

export type ComposeEmailFormValues = z.infer<typeof composeEmailSchema>;

export const senderSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.number({ invalid_type_error: 'SMTP port must be a number' }),
  smtpUser: z.string().min(1, 'SMTP username is required'),
  smtpPass: z.string().min(1, 'SMTP password is required'),
});

export type SenderFormValues = z.infer<typeof senderSchema>;
