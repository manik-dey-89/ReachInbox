# ReachInbox Architecture Overview

## Project Summary

ReachInbox is a production-grade email scheduling platform that lets authenticated users compose, schedule, and monitor bulk email campaigns. It uses BullMQ delayed jobs (backed by Redis) for scheduling, PostgreSQL (via Prisma) as the system of record, Elasticsearch for fast search, and Slack for operational notifications.

---

## Monorepo Layout

```
reachinbox/
├── apps/
│   ├── api/          — Express.js REST API + BullMQ queue definitions
│   ├── worker/       — Standalone BullMQ worker process
│   └── web/          — Next.js frontend (TypeScript + Tailwind CSS)
├── packages/
│   └── shared/       — Shared TypeScript enums, interfaces, and payload types
├── infrastructure/
│   └── nginx/        — Reverse-proxy config (optional local TLS termination)
├── docs/             — Architecture and API documentation
├── e2e/              — End-to-end test suites
├── .env.example      — Environment variable template
├── package.json      — npm workspaces root
└── tsconfig.base.json
```

---

## Application Layers

### 1. API (`apps/api`)

```
src/
├── config/        — Environment validation, Redis client, Prisma client, logger
├── middleware/    — Auth guard, error handler, request logger, rate-limit middleware
├── controllers/   — Thin HTTP handlers; delegate all logic to services
├── services/      — Business logic (campaign, sender, search, Slack, rate-limit)
├── repositories/  — Prisma query wrappers; single database access point
├── routes/        — Express router definitions
├── queues/        — BullMQ Queue instances and job-data builders
│   └── processors/ — Job processors (re-exported to worker)
└── utils/         — Encryption, validators, idempotency helpers
```

#### Key responsibilities
- Authenticate requests via Google OAuth session cookies (Passport.js).
- Validate and persist campaign + recipient records.
- Enqueue BullMQ delayed jobs for each recipient at the correct future timestamp.
- Expose REST endpoints consumed by the frontend.
- Expose Bull Board at `/admin/queues` (auth-gated).

### 2. Worker (`apps/worker`)

A separate Node.js process that runs BullMQ `Worker` instances. Keeping the worker separate from the API means:
- Worker crashes do not take down the HTTP server.
- Worker can be scaled horizontally (multiple replicas, each consuming from the same Redis-backed queue).

#### Email job lifecycle
```
[API enqueues job with delay]
        ↓
[BullMQ moves job to delayed set in Redis]
        ↓
[At scheduledFor time, BullMQ moves job to waiting]
        ↓
[Worker picks up job (concurrency-limited)]
        ↓
[Check idempotency key in DB — skip if already COMPLETED]
        ↓
[Check global + per-sender hourly rate limit in Redis]
   ├── Limit OK  → send email via Nodemailer, write DeliveryLog, mark COMPLETED
   └── Limit hit → reschedule job to start of next hour window, mark RATE_LIMITED,
                   notify Slack, record reason in EmailJob.lastError
```

### 3. Frontend (`apps/web`)

Next.js App Router application with:
- **Route groups**: `(auth)` for login, `(app)` for protected pages.
- **API calls**: all data fetched from `apps/api`; no fake/hardcoded statistics.
- **Themes**: Tailwind CSS with dark/light mode via `next-themes`.
- **State**: React Query (`@tanstack/react-query`) for server state; no global store for data that the server owns.

---

## Data Model

```
User ──────────────────── OAuthAccount (provider: GOOGLE | SLACK)
 │
 ├── SenderAccount        (SMTP credentials, encrypted smtpPass)
 │
 ├── EmailCampaign ──┬─── EmailRecipient ──── EmailJob ──── EmailDeliveryLog
 │                  │
 │                  └─── (status: DRAFT → SCHEDULED → SENDING → COMPLETED)
 │
 ├── SlackIntegration
 │
 └── AuditLog
```

### Idempotency strategy

Each `EmailJob` carries an `idempotencyKey` (`campaignId:recipientId:attempt`). Before the worker calls SMTP:

1. Atomic `UPDATE email_jobs SET status = 'PROCESSING' WHERE id = ? AND status = 'PENDING'` — if 0 rows updated, another worker already claimed it; skip.
2. SMTP send.
3. Write `EmailDeliveryLog` and `UPDATE email_jobs SET status = 'COMPLETED'`.

**Known limitation**: the gap between SMTP acceptance (the server said "250 OK") and the database commit is a window where a crash could cause a duplicate send on retry. Full exactly-once delivery requires SMTP servers to support idempotent submission (none of the mainstream ones do). The mitigation here is: check for an existing `EmailDeliveryLog` with status `SENT` before retrying, and skip if found.

---

## Rate Limiting

### Storage
Redis sorted sets and counters, one key per `{scope}:{windowStart}`:
- `rate:global:{hourEpoch}` — global counter
- `rate:sender:{senderId}:{hourEpoch}` — per-sender counter

### Algorithm
Lua script executed atomically on each attempt:
```lua
local current = redis.call('INCR', key)
redis.call('EXPIREAT', key, windowExpiry)
return current
```
If `current > limit`, the worker does not send; instead it reschedules the BullMQ job to `startOfNextHour + smallJitter` milliseconds in the future.

### Configuration
`GLOBAL_HOURLY_LIMIT` and `SENDER_HOURLY_LIMIT` from environment variables; defaults 100 and 50.

---

## Authentication

- **Google OAuth 2.0** via Passport.js `passport-google-oauth20`.
- Session stored server-side in PostgreSQL (`express-session` + `connect-pg-simple`).
- Session cookie is `httpOnly`, `sameSite: lax`, `secure` in production.
- API routes protected by `requireAuth` middleware that checks `req.user`.
- Frontend protected routes check session via `GET /api/me`; redirect to `/login` on 401.

---

## Slack Integration

- OAuth 2.0 flow: user clicks "Connect Slack" → redirect to Slack → callback stores `bot_token` (AES-256-GCM encrypted at rest).
- Notifications sent via `@slack/web-api` `chat.postMessage` to the workspace's default channel.
- Triggers: global rate-limit hit, per-sender rate-limit hit, campaign completed with failures.
- If `SlackIntegration` row is missing or `disconnectedAt` is set, notifications are silently skipped; the application does not crash.

---

## Elasticsearch

- Index: `email_recipients` — mirrored from `EmailRecipient` + campaign subject on write.
- The API service writes to ES after every status change; failures are logged but do not roll back the database write (ES is not the source of truth).
- Search API (`GET /api/search`) queries ES with bool query on `recipientEmail`, `subject`, `status`, and date range.
- If ES is unavailable, the API falls back to a Prisma `findMany` query and sets `degraded: true` in the response.

---

## Queue Monitoring

Bull Board is mounted at `GET /admin/queues` on the API server. Access requires:
- Active session (`requireAuth`).
- User email matching `ADMIN_EMAIL` env var.

Bull Board shows waiting, delayed, active, completed, and failed jobs with retry controls.

---

## Infrastructure

| Service       | Default port | Notes                          |
|---------------|-------------|--------------------------------|
| PostgreSQL    | 5432        | Primary database               |
| Redis         | 6379        | Queue + rate-limit counters    |
| Elasticsearch | 9200        | Search index                   |
| API           | 3001        | Express.js                     |
| Worker        | —           | No HTTP port; queue consumer   |
| Web           | 3000        | Next.js                        |
| Nginx         | 80 / 443    | Optional reverse proxy         |

A `docker-compose.yml` at the repo root starts Postgres, Redis, and Elasticsearch for local development. The three application processes (`api`, `worker`, `web`) run directly on the host with `npm run dev`.

---

## Security Notes

- SMTP passwords stored AES-256-GCM encrypted; `ENCRYPTION_KEY` never logged.
- Slack bot tokens stored AES-256-GCM encrypted.
- OAuth client secrets in environment variables only; never in code or frontend bundles.
- `helmet` on the Express app sets standard security headers.
- Input validated with `zod` at every API boundary.
- SQL injection prevented by Prisma's parameterized queries.
- CSRF: session-cookie `sameSite: lax` mitigates most CSRF; additional `csurf` middleware on state-changing routes in production.
- API rate limiting (`express-rate-limit`) on auth endpoints to prevent credential stuffing.

---

## Development Quick-Start

```bash
# 1. Copy and fill environment variables
cp .env.example .env

# 2. Start infrastructure
docker compose up -d

# 3. Install dependencies
npm install

# 4. Run database migrations
npm run db:migrate

# 5. Start all apps in development mode
npm run dev
```
