/**
 * Generates an idempotency key for tracking email delivery attempts.
 * Format: email:{campaignId}:{recipientId}
 */
export function generateIdempotencyKey(campaignId: string, recipientId: string): string {
  return `email:${campaignId}:${recipientId}`;
}

/**
 * Generates a stable BullMQ job ID to prevent duplicate job enqueueing.
 * Format: email:{campaignId}:{recipientId}
 */
export function generateBullJobId(campaignId: string, recipientId: string): string {
  return `email:${campaignId}:${recipientId}`;
}
