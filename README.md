# ReachInbox

A full-stack email job scheduler built for the Outbox Labs internship assignment. ReachInbox lets authenticated users compose bulk email campaigns, schedule delivery via BullMQ delayed jobs, enforce distributed rate limits, and monitor queue health — all from a responsive SaaS UI.

---

## Features

- **Google OAuth 2.0** authentication with secure server-side sessions
- **Multi-user data isolation** — every resource is scoped to the authenticated user
- **Email composition** with subject, body, and multiple recipients
- **CSV and TXT recipient upload** with per-row validation and duplicate detection
- **Email address validation** at upload and scheduling time
- **BullMQ delayed job scheduling** — jobs fire at a future timestamp, not on a cron
- **Configurable delay between emails** per campaign
- **Global and per-sender hourly rate limits** enforced with an atomic Redis Lua script
- **Rate-limited jobs rescheduled** to the next hour window — never discarded
- **Ethereal SMTP delivery** with preview URLs in the Sent table
- **Multiple sender account support** per user
- **Idempotency** — duplicate delivery prevention via unique `EmailDeliveryLog` records
- **Worker crash recovery** — jobs survive Redis restarts; interrupted jobs are re-queued on startup
- **Slack OAuth integration** with rate-limit and completion notifications
- **Elasticsearch full-text search** over sent emails
- **Graceful ES degradation** — falls back to Prisma query when Elasticsearch is unavailable
- **Bull Board live queue dashboard** at `/admin/queues`
- **Dashboard with real stats** — no hardcoded data
- **Dark / light theme** toggle
- **Responsive SaaS UI** built with Tailwind CSS
- **Docker Compose full-stack deployment**
- **Automated tests: 85 tests** (53 API · 26 web · 6 E2E)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ReachInbox                               │
├──────────────┬──────────────────────────┬───────────────────────┤
│   Browser    │      Next.js 14          │   Express API         │
│              │      (port 3000)         │   (port 3001)         │
│  React UI ───┼──► App Router pages ────┼──► Controllers        │
│              │      Tailwind CSS        │    Services            │
│              │      React Query         │    Repositories       │
├──────────────┴──────────────────────────┼───────────────────────┤
│                                         │         │             │
│                              ┌──────────▼──┐  ┌───▼─────────┐  │
│                              │ PostgreSQL  │  │   Redis 7   │  │
│                              │ (Prisma ORM)│  │  Sessions + │  │
│                              │             │  │  BullMQ     │  │
│                              └─────────────┘  └───┬─────────┘  │
│                                                   │             │
│                              ┌────────────────────▼──────────┐ │
│                              │      BullMQ Worker            │ │
│                              │   email-queue processor       │ │
│                              │   Rate limiting (Lua)         │ │
│                              │   Idempotency checks          │ │
│                              │   Nodemailer + Ethereal SMTP  │ │
│                              └───────────────────────────────┘ │
│                                                                 │
│                              ┌─────────────────────────────┐   │
│                              │    Elasticsearch 8          │   │
│                              │   Email search index        │   │
│                              └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SaaS UI, server components |
| Styling | Tailwind CSS + shadcn/ui | Design system |
| Client state | React Query (@tanstack/react-query) | Server-state caching |
| API | Express.js (Node 18) | REST endpoints |
| Auth | Passport.js + passport-google-oauth20 | Google OAuth 2.0 |
| ORM | Prisma | Type-safe PostgreSQL access |
| Database | PostgreSQL 15 | Primary data store |
| Queue | BullMQ | Delayed job scheduling |
| Cache / queue store | Redis 7 | BullMQ backend + rate-limit counters |
| Email | Nodemailer + Ethereal SMTP | Test email delivery |
| Search | Elasticsearch 8 | Full-text email search |
| Notifications | @slack/web-api | Slack bot messages |
| Encryption | Node crypto (AES-256-GCM) | SMTP password + Slack token storage |
| Validation | Zod | Schema validation at every boundary |
| Monitoring | Bull Board (@bull-board/express) | Live queue dashboard |
| Testing | Vitest | Unit + integration + E2E tests |
| Containers | Docker Compose | Local full-stack deployment |

---

## Prerequisites

- **Node.js 18+**
- **Docker Desktop** — required for the Docker Compose quick-start
- **Git**
- **A Google Cloud project** — for OAuth credentials (required to log in)
- **A Slack app** — optional, only needed for rate-limit notifications

---

## Quick Start (Docker Compose)

```bash
git clone <repo>
cd reachinbox
cp .env.example .env
# Edit .env — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, ENCRYPTION_KEY
docker compose up --build
```

Services available once containers are healthy:

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API | http://localhost:3001 |
| Bull Board | http://localhost:3001/admin/queues |

---

## Manual Setup (without Docker)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start PostgreSQL and Redis** (locally or via Docker)
   ```bash
   docker compose up -d postgres redis elasticsearch
   ```

3. **Copy and configure environment variables**
   ```bash
   cp .env.example .env
   # Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, ENCRYPTION_KEY
   ```

4. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

5. **Generate Prisma client**
   ```bash
   npm run db:generate
   ```

6. **Seed test data** (optional)
   ```bash
   npm run db:seed
   ```

7. **Start the API server**
   ```bash
   npm run dev --workspace=apps/api
   ```

8. **Start the worker**
   ```bash
   npm run dev --workspace=apps/worker
   ```

9. **Start the web app**
   ```bash
   npm run dev --workspace=apps/web
   ```

Or start all three in one terminal:
```bash
npm run dev
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `SESSION_SECRET` | Yes | — | Secret for `express-session` (min 32 chars) |
| `ENCRYPTION_KEY` | Yes | — | 64-char hex string (32 bytes) for AES-256-GCM |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Yes | `http://localhost:3001/auth/google/callback` | Full OAuth redirect URI |
| `SLACK_CLIENT_ID` | Yes* | — | Slack app client ID (*required at startup) |
| `SLACK_CLIENT_SECRET` | Yes* | — | Slack app client secret |
| `SLACK_REDIRECT_URI` | Yes* | `http://localhost:3001/api/slack/callback` | Slack OAuth redirect URI |
| `ELASTICSEARCH_URL` | No | `http://localhost:9200` | Elasticsearch node URL |
| `API_PORT` | No | `3001` | Port the API listens on |
| `API_HOST` | No | `0.0.0.0` | Bind address for the API |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed CORS origin |
| `SESSION_MAX_AGE_MS` | No | `86400000` | Session lifetime in milliseconds |
| `GLOBAL_HOURLY_LIMIT` | No | `100` | Max emails sent per hour across all senders |
| `SENDER_HOURLY_LIMIT` | No | `50` | Max emails sent per hour per sender account |
| `WORKER_CONCURRENCY` | No | `5` | Parallel jobs the worker processes |
| `WORKER_MAX_RETRIES` | No | `3` | BullMQ job retry attempts on failure |
| `ADMIN_EMAIL` | No | `admin@example.com` | Email address allowed to access Bull Board |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3001` | API base URL used by the Next.js frontend |
| `NEXTAUTH_URL` | No | `http://localhost:3000` | Next.js app base URL |
| `NEXTAUTH_SECRET` | No | — | Secret for NextAuth (if used) |

> **Generating secrets**
> ```bash
> # SESSION_SECRET
> openssl rand -base64 32
> # ENCRYPTION_KEY (64-char hex)
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Google OAuth Setup

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Set Application type to **Web application**
6. Add an authorized redirect URI: `http://localhost:3001/auth/google/callback`
7. Copy the **Client ID** and **Client Secret** into `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
   ```

---

## Ethereal SMTP

No configuration needed for local testing. The API creates an Ethereal test account on first startup if no sender account exists. After emails are sent, preview URLs appear in the Sent emails table — they look like `https://ethereal.email/message/...`. Nothing lands in a real inbox.

For production, replace the Ethereal account credentials with a real SMTP provider (SendGrid, Postmark, SES, etc.) via the Senders page.

---

## Slack OAuth Setup

Slack is optional. The app works fully without it; rate-limit notifications are silently skipped when no integration is configured.

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App → From scratch**
3. Under **OAuth & Permissions**, add the bot token scopes: `chat:write`, `incoming-webhook`
4. Add a redirect URL: `http://localhost:3001/api/slack/callback`
5. Copy **Client ID** and **Client Secret** to `.env`:
   ```
   SLACK_CLIENT_ID=your-slack-client-id
   SLACK_CLIENT_SECRET=your-slack-client-secret
   SLACK_REDIRECT_URI=http://localhost:3001/api/slack/callback
   ```
6. In the ReachInbox UI, go to the **Slack Integration** page and click **Connect to Slack**

---

## API Endpoint Reference

All endpoints are prefixed with `/api`. Endpoints marked **Auth** require an active session cookie.

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/google` | No | Initiates Google OAuth redirect |
| GET | `/auth/google/callback` | No | OAuth callback — creates session |
| POST | `/auth/logout` | No | Destroys session |
| GET | `/auth/me` | Yes | Returns current user object |

### Campaigns

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/campaigns` | Yes | List all campaigns for the user |
| POST | `/campaigns` | Yes | Create a new campaign |
| GET | `/campaigns/:id` | Yes | Get a single campaign |
| DELETE | `/campaigns/:id` | Yes | Cancel / delete a campaign |
| POST | `/campaigns/:id/schedule` | Yes | Schedule the campaign (enqueues BullMQ jobs) |

### Recipients

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/campaigns/:id/recipients` | Yes | List recipients for a campaign |
| POST | `/campaigns/:id/recipients/upload` | Yes | Upload CSV or TXT file of recipients |

### Jobs

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/campaigns/:id/jobs` | Yes | List email jobs for a campaign |

### Senders

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/senders` | Yes | List sender accounts |
| POST | `/senders` | Yes | Add a sender account |
| DELETE | `/senders/:id` | Yes | Remove a sender account |

### Slack

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/slack/connect` | Yes | Initiates Slack OAuth redirect |
| GET | `/slack/callback` | No | Slack OAuth callback |
| GET | `/slack/status` | Yes | Returns connection status |
| POST | `/slack/disconnect` | Yes | Revokes Slack integration |

### Search

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/search/emails` | Yes | Full-text search over sent emails |

### Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/stats` | Yes | Aggregate campaign and delivery stats |

### Rate Limits

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/rate-limits/status` | Yes | Current global and per-sender counters |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Liveness check — returns `{ status: "ok" }` |

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/queues/*` | Yes + Admin | Bull Board queue monitoring UI |

---

## Testing

```bash
# All tests (runs every workspace that has a test script)
npm test

# API unit + integration tests (53 tests)
npm run test:api

# Frontend component tests (26 tests)
npm run test:web

# E2E mocked flow (6 tests)
npm run test:e2e

# TypeScript type-check (all packages)
npm run typecheck
```

Test results from the final run:

| Suite | Files | Tests | Result |
|---|---|---|---|
| API (`apps/api`) | 5 | 53 | ✅ passed |
| Web (`apps/web`) | 3 | 26 | ✅ passed |
| E2E (`e2e`) | 1 | 6 | ✅ passed |
| **Total** | **9** | **85** | **✅ all passed** |

---

## Rate Limiting

ReachInbox enforces two independent hourly counters, both stored in Redis:

- **Global limit** — key `rate:global:{hourEpoch}`, shared across all senders and worker instances.
- **Per-sender limit** — key `rate:sender:{senderId}:{hourEpoch}`, scoped to one SMTP account.

Both counters are incremented inside a single Lua `EVAL` call, making the check-increment-expire sequence atomic. No two workers can race past the same limit.

When a job hits a limit, the worker:
1. Does **not** send the email.
2. Re-queues the BullMQ job with a delay of `msUntilNextHour()` — the job fires at the top of the next hour.
3. Sets the `EmailJob` status to `RATE_LIMITED` and stores the reason in `lastError`.
4. Sends a Slack notification if an integration is configured.

Jobs are **never discarded** when rate-limited.

---

## Exactly-Once Delivery

ReachInbox implements best-effort idempotency, not true exactly-once delivery.

Before sending, the worker checks `EmailDeliveryLog` for an existing `SENT` record for that recipient and campaign. If one exists, the job is skipped without calling SMTP.

**Known limitation**: SMTP acceptance and database commit cannot be made atomic. If the worker crashes after the SMTP server accepts the message (returns `250 OK`) but before the delivery log is written, that email was sent but no log exists. A subsequent retry will send a duplicate.

Mitigations in place: exponential backoff retries, BullMQ stalled-job detection, and a unique `bullJobId` per recipient so the same job cannot be enqueued twice. Full exactly-once delivery at the SMTP level requires transactional outbox pattern support that no mainstream SMTP server provides.

---

## Restart Recovery

BullMQ stores all job state in Redis with append-only persistence (`appendonly yes`). Jobs in `DELAYED`, `WAITING`, or `ACTIVE` state survive a worker restart.

Additionally, on startup the worker calls `recoverInterruptedJobs()`, which queries the database for `EmailJob` records stuck in `PROCESSING` status for more than 10 minutes and re-enqueues them. BullMQ's built-in stalled-job detection handles jobs that were `ACTIVE` when the worker crashed.

---

## Known Limitations

- **Exactly-once delivery** — see the section above. Duplicates are possible in a crash-between-send-and-commit window.
- **Elasticsearch** — single-node setup, not production-grade. The app degrades gracefully (Prisma fallback) when ES is unavailable.
- **Google OAuth** — requires real credentials. The login flow will not work without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **Slack OAuth** — optional. The app runs fully without it; rate-limit notifications are silently skipped.
- **Bull Board** — requires the requesting user's email to match `ADMIN_EMAIL`.
- **Plain-text email body only** — no HTML template engine. HTML support can be added by switching to `html:` in the Nodemailer options.
- **No unsubscribe mechanism**.
- **Ethereal SMTP is for testing only** — configure a real SMTP provider for production use.

---

## Assignment Compliance Checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Google OAuth 2.0 login | ✅ |
| 2 | Multi-user data isolation | ✅ |
| 3 | Email composition (subject, body, recipients) | ✅ |
| 4 | CSV / TXT recipient upload | ✅ |
| 5 | Email address validation | ✅ |
| 6 | Duplicate recipient detection | ✅ |
| 7 | BullMQ delayed job scheduling (not cron) | ✅ |
| 8 | Configurable per-email delay | ✅ |
| 9 | Global hourly rate limit (Redis) | ✅ |
| 10 | Per-sender hourly rate limit (Redis) | ✅ |
| 11 | Atomic Lua script for rate-limit check+increment | ✅ |
| 12 | Rate-limited jobs rescheduled, never discarded | ✅ |
| 13 | Ethereal SMTP delivery with preview URLs | ✅ |
| 14 | Multiple sender account support | ✅ |
| 15 | Idempotency (duplicate delivery prevention) | ✅ |
| 16 | Worker crash recovery / restart resilience | ✅ |
| 17 | Slack OAuth integration | ~ requires SLACK_CLIENT_ID/SECRET |
| 18 | Slack rate-limit notifications | ~ requires Slack connected |
| 19 | Elasticsearch email search | ✅ |
| 20 | Graceful ES degradation | ✅ |
| 21 | Bull Board queue monitoring | ✅ |
| 22 | Dashboard with real stats | ✅ |
| 23 | Dark/light theme | ✅ |
| 24 | Docker Compose deployment | ✅ |
| 25 | Automated test suite | ✅ 85 tests |
