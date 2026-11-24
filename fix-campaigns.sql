-- Check campaign statuses
SELECT id, subject, status, "sentCount", "totalRecipients", "completedAt"
FROM "EmailCampaign"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Fix any campaigns where sentCount >= totalRecipients but still SCHEDULED
UPDATE "EmailCampaign"
SET status = 'COMPLETED', "completedAt" = NOW()
WHERE status = 'SCHEDULED'
  AND "sentCount" >= "totalRecipients"
  AND "totalRecipients" > 0;

-- Check EmailJob statuses
SELECT id, status, "recipientId", "processedAt"
FROM "EmailJob"
ORDER BY "createdAt" DESC
LIMIT 10;
