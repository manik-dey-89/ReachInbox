SELECT 'Campaigns' as entity, status, COUNT(*) as count FROM "EmailCampaign" GROUP BY status ORDER BY status;
SELECT 'Jobs' as entity, status, COUNT(*) as count FROM "EmailJob" GROUP BY status ORDER BY status;
SELECT COUNT(*) as sent_delivery_logs FROM "EmailDeliveryLog" WHERE status = 'SENT';
SELECT COUNT(*) as users FROM "User";
SELECT COUNT(*) as senders FROM "SenderAccount";
SELECT name, "teamName" as slack_team FROM "SlackIntegration" WHERE "disconnectedAt" IS NULL LIMIT 1;
