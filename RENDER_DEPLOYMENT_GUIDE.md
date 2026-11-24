# ReachInbox — Render Deployment Guide

Complete, beginner-friendly instructions for deploying ReachInbox on Render's free tier.

---

## Section 1: Overview

### What you will create on Render

| # | Render Service Type | Name | Purpose |
|---|---------------------|------|---------|
| 1 | PostgreSQL (database) | reachinbox-db | Stores all application data |
| 2 | Redis (key-value store) | reachinbox-redis | Session storage, job queue |
| 3 | Web Service (Node) | reachinbox-backend | REST API + OAuth + Bull Board |
| 4 | Background Worker (Node) | reachinbox-worker | BullMQ email processor |
| 5 | Web Service (Node) | reachinbox-frontend | Next.js UI |

### Architecture

```
Browser
  │
  ▼
reachinbox-frontend (Next.js, port $PORT)
  │  rewrites /api/* → reachinbox-backend
  │
  ▼
reachinbox-backend (Express, port $PORT)
  │  reads/writes → reachinbox-db (PostgreSQL)
  │  pushes jobs  → reachinbox-redis (Redis)
  │
  ▼
reachinbox-worker (BullMQ)
  │  polls jobs from → reachinbox-redis
  │  reads/writes    → reachinbox-db
  │  sends emails via SMTP
```

### Estimated cost (free tier)

All services use Render's free tier — $0/month for development and testing. Free services sleep after 15 minutes of inactivity (first request wakes them in ~30 seconds). For production traffic, upgrade to Starter (~$7/month per service).

### Time to deploy

Approximately 30 minutes for a first-time deployment.

---

## Section 2: Prerequisites

Before starting, make sure you have the following:

1. **GitHub repository** — Your code must be pushed to a GitHub (or GitLab) repo that Render can access. If the repo is private, you will authorize Render to access it during service creation.

2. **Render account** — Sign up free at https://render.com.

3. **Google Cloud Console access** — You need an existing OAuth 2.0 client ID and secret from https://console.cloud.google.com. You will update its redirect URIs after deploying.

4. **Slack API access** (optional) — If you use Slack integration, you need your App's Client ID and Secret from https://api.slack.com/apps.

5. **Node.js installed locally** — Needed only to generate secret keys before you start. Version 18+ works fine.

---

## Section 3: Step-by-Step Service Creation

### 3A. Backend Web Service

1. In your Render dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Fill in the form:
   - **Name:** `reachinbox-backend`
   - **Region:** Oregon (US West)
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** `apps/backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build && npx prisma generate`
   - **Start Command:** `npx prisma migrate deploy && node dist/index.js`
   - **Plan:** Free
4. Do **not** deploy yet — scroll down and add environment variables first (Section 6).
5. Click **Create Web Service**.

### 3B. Worker Background Worker

1. Click **New +** → **Background Worker**.
2. Connect the same repository.
3. Fill in:
   - **Name:** `reachinbox-worker`
   - **Region:** Oregon (US West)
   - **Branch:** `main`
   - **Root Directory:** `apps/worker`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/index.js`
   - **Plan:** Free
4. Add environment variables (Section 6) before deploying.
5. Click **Create Background Worker**.

### 3C. Frontend Web Service

1. Click **New +** → **Web Service**.
2. Connect the same repository.
3. Fill in:
   - **Name:** `reachinbox-frontend`
   - **Region:** Oregon (US West)
   - **Branch:** `main`
   - **Root Directory:** `apps/frontend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Add environment variables (Section 6).
5. Click **Create Web Service**.

---

## Section 4: PostgreSQL Setup

1. In your Render dashboard, click **New +** → **PostgreSQL**.
2. Fill in:
   - **Name:** `reachinbox-db`
   - **Database:** `reachinbox`
   - **User:** `reachinbox`
   - **Region:** Oregon (US West)
   - **Plan:** Free
3. Click **Create Database**.
4. Wait for it to become **Available** (usually under 2 minutes).
5. On the database's detail page, find **Internal Database URL** and copy it. This is your `DATABASE_URL`. Use the **Internal** URL (not External) so traffic stays within Render's network.

> **Note:** The backend's start command includes `npx prisma migrate deploy`, which automatically runs all pending database migrations on every deploy. You do not need to run migrations manually.

> **Free tier warning:** Render deletes free PostgreSQL databases that have been inactive for 90 days. Export your data before that or upgrade to a paid plan.

---

## Section 5: Redis Setup

1. In your Render dashboard, click **New +** → **Redis**.
2. Fill in:
   - **Name:** `reachinbox-redis`
   - **Region:** Oregon (US West)
   - **Plan:** Free
3. Click **Create Redis**.
4. Once available, copy the **Internal Redis URL**. This is your `REDIS_URL`.

> **Note:** Always use the **Internal** Redis URL. The external URL only works from outside Render's network and counts against bandwidth limits.

> **Free tier note:** Render's free Redis has 25 MB storage and no persistence. If the worker restarts, queued jobs may be lost. For reliable processing, upgrade to a paid Redis plan.

---

## Section 6: Environment Variables — Complete Reference

Set these in each service's **Environment** tab on Render before the first deploy.

### Backend (`reachinbox-backend`)

| Variable | Value / How to Get It | Required |
|----------|----------------------|----------|
| `NODE_ENV` | `production` | Yes |
| `DATABASE_URL` | Internal Database URL from Section 4 | Yes |
| `REDIS_URL` | Internal Redis URL from Section 5 | Yes |
| `SESSION_SECRET` | Generate: `openssl rand -hex 32` (must be 32+ chars) | Yes |
| `ENCRYPTION_KEY` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — must be exactly 64 hex characters | Yes |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console → Credentials | Yes (for OAuth login) |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console → Credentials | Yes (for OAuth login) |
| `GOOGLE_CALLBACK_URL` | `https://reachinbox-backend.onrender.com/api/auth/google/callback` | Yes (for OAuth login) |
| `SLACK_CLIENT_ID` | From api.slack.com/apps → your app → Basic Information | No |
| `SLACK_CLIENT_SECRET` | From api.slack.com/apps → your app → Basic Information | No |
| `SLACK_REDIRECT_URI` | `https://reachinbox-backend.onrender.com/api/slack/callback` | No |
| `CORS_ORIGIN` | `https://reachinbox-frontend.onrender.com` (set after frontend deploys) | Yes |
| `GLOBAL_HOURLY_LIMIT` | `100` | No (default: 100) |
| `SENDER_HOURLY_LIMIT` | `50` | No (default: 50) |
| `ELASTICSEARCH_URL` | Bonsai URL or leave empty to skip (see Section 10) | No |
| `ADMIN_EMAIL` | Your Google login email (for Bull Board access) | No |
| `PORT` | **Do NOT set.** Render injects this automatically. | — |

### Worker (`reachinbox-worker`)

| Variable | Value / How to Get It | Required |
|----------|----------------------|----------|
| `NODE_ENV` | `production` | Yes |
| `DATABASE_URL` | Same Internal Database URL as backend | Yes |
| `REDIS_URL` | Same Internal Redis URL as backend | Yes |
| `ENCRYPTION_KEY` | Same value as backend (must match exactly) | Yes |
| `WORKER_CONCURRENCY` | `2` (safe for free tier) | No (default: 5) |
| `WORKER_MAX_RETRIES` | `3` | No (default: 3) |
| `GLOBAL_HOURLY_LIMIT` | `100` | No |
| `SENDER_HOURLY_LIMIT` | `50` | No |
| `ELASTICSEARCH_URL` | Same as backend if using ES | No |

### Frontend (`reachinbox-frontend`)

| Variable | Value / How to Get It | Required |
|----------|----------------------|----------|
| `NODE_ENV` | `production` | Yes |
| `NEXT_PUBLIC_API_URL` | `https://reachinbox-backend.onrender.com` | Yes |
| `PORT` | **Do NOT set.** Render injects this automatically. | — |

---

## Section 7: OAuth Configuration for Production

### Google OAuth

After your backend service is deployed and you have its URL:

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**.
2. Click on your OAuth 2.0 Client ID to edit it.
3. Under **Authorized JavaScript origins**, add:
   ```
   https://reachinbox-frontend.onrender.com
   ```
4. Under **Authorized redirect URIs**, add:
   ```
   https://reachinbox-backend.onrender.com/api/auth/google/callback
   ```
5. Click **Save**.
6. Go back to Render and set `GOOGLE_CALLBACK_URL` on the backend service to:
   ```
   https://reachinbox-backend.onrender.com/api/auth/google/callback
   ```

### Slack OAuth

If you use Slack integration:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → select your app.
2. In the left sidebar, click **OAuth & Permissions**.
3. Under **Redirect URLs**, click **Add New Redirect URL** and add:
   ```
   https://reachinbox-backend.onrender.com/api/slack/callback
   ```
4. Click **Save URLs**.
5. Set `SLACK_REDIRECT_URI` on the backend service to this same URL.

---

## Section 8: Deployment Order

Deploy services in this exact order to avoid startup failures caused by missing dependencies.

### Step 1 — Create PostgreSQL

Follow Section 4. Wait until status shows **Available**.

### Step 2 — Create Redis

Follow Section 5. Wait until status shows **Available**.

### Step 3 — Deploy Backend

1. Create the backend service (Section 3A).
2. Add all backend environment variables (Section 6).
3. Set `DATABASE_URL` to the PostgreSQL Internal URL.
4. Set `REDIS_URL` to the Redis Internal URL.
5. Click **Save Changes** and wait for the deploy to complete.
6. Copy the backend URL: `https://reachinbox-backend.onrender.com` (or whatever Render assigns).
7. Verify: open `https://YOUR-BACKEND.onrender.com/health` — it should return `{"status":"ok"}`.

### Step 4 — Deploy Worker

1. Create the worker service (Section 3B).
2. Add all worker environment variables (Section 6).
3. Set `DATABASE_URL` and `REDIS_URL` to the same values as the backend.
4. Click **Save Changes** and wait for the deploy to complete.
5. In Render logs for the worker, you should see: `Worker started, concurrency: 2, queue: email-queue`.

### Step 5 — Deploy Frontend

1. Create the frontend service (Section 3C).
2. Set `NEXT_PUBLIC_API_URL` to the backend URL from Step 3.
3. Click **Save Changes** and wait for the deploy to complete.
4. Copy the frontend URL: `https://reachinbox-frontend.onrender.com`.

### Step 6 — Update CORS

1. Go to the **backend** service on Render → **Environment**.
2. Set `CORS_ORIGIN` to the frontend URL from Step 5 (no trailing slash):
   ```
   https://reachinbox-frontend.onrender.com
   ```
3. Save and redeploy the backend.

### Step 7 — Update OAuth redirect URIs

Follow Section 7 now that you have both URLs.

---

## Section 9: Post-Deployment Verification

Work through this checklist after all services are live.

- [ ] **Backend health check** — `GET https://YOUR-BACKEND.onrender.com/health` returns `{"status":"ok"}`.
- [ ] **Frontend loads** — Opening `https://YOUR-FRONTEND.onrender.com` shows the ReachInbox login page.
- [ ] **Google OAuth login** — Clicking "Sign in with Google" redirects to Google's consent screen and returns you to the dashboard.
- [ ] **Dashboard loads data** — The dashboard shows your campaigns (empty on first login is fine).
- [ ] **Add a sender account** — Go to Senders, add an SMTP account (Ethereal works for testing).
- [ ] **Create and schedule a campaign** — Compose an email, add a recipient, schedule it.
- [ ] **Worker processes the job** — Open Render logs for `reachinbox-worker` and confirm you see `Job completed` after the scheduled time.
- [ ] **Sent page shows preview link** — If using Ethereal, the sent email shows a preview URL.
- [ ] **Bull Board accessible** — `GET https://YOUR-BACKEND.onrender.com/admin/queues` (requires login with `ADMIN_EMAIL`).
- [ ] **Slack connect** — If configured, go to Settings → Slack and complete the OAuth flow.

---

## Section 10: Elasticsearch (Optional)

Elasticsearch enables fast full-text search across campaigns and emails. Without it, the app falls back to database queries and shows a "degraded search" banner — the application remains fully functional.

### Free option: Bonsai

[Bonsai](https://bonsai.io) offers a free Elasticsearch tier (125 MB, single node).

1. Sign up at https://bonsai.io.
2. Create a new cluster (choose a region close to Oregon if possible).
3. Once the cluster is **Green**, go to **Access** → copy the **Elasticsearch URL** (it looks like `https://user:password@your-cluster.bonsai.io`).
4. Set `ELASTICSEARCH_URL` to this URL on both the backend and worker services.
5. Redeploy both services.

If you leave `ELASTICSEARCH_URL` empty, the backend connects to `http://localhost:9200`, which will fail silently, and all search endpoints will fall back to database queries automatically.

---

## Section 11: Troubleshooting

### 1. "Application failed to start" in deploy logs

Look at the full build and deploy log. The most common cause is a missing or invalid environment variable. The backend and worker validate all env vars at startup and print a clear error listing which variables are wrong.

**Fix:** Go to the service's **Environment** tab, correct the variable, and redeploy.

### 2. Prisma migration fails

The error typically reads: `Error: P1001: Can't reach database server`.

**Fix:** Make sure `DATABASE_URL` is the **Internal** database URL (starts with `postgresql://`), not the External URL. Also confirm the PostgreSQL service status is **Available**, not **Creating**.

### 3. CORS errors in browser console

The browser shows: `Access to fetch has been blocked by CORS policy`.

**Fix:** `CORS_ORIGIN` on the backend must exactly match the frontend URL — no trailing slash, correct protocol (`https://`). Example: `https://reachinbox-frontend.onrender.com` ✓ vs `https://reachinbox-frontend.onrender.com/` ✗.

### 4. OAuth callback mismatch

Google or Slack returns: `redirect_uri_mismatch`.

**Fix:** The redirect URI registered in Google Cloud Console / Slack must exactly match `GOOGLE_CALLBACK_URL` / `SLACK_REDIRECT_URI` — same scheme, domain, and path. No trailing slash. Update the OAuth provider settings and the Render env var to match.

### 5. Session not persisting (logged out after every request)

**Fix:** `SESSION_SECRET` must be a fixed value, not rotated between deploys. In `render.yaml`, the blueprint uses `generateValue: true`, which generates it once and keeps it stable — this is correct. If you set it manually, make sure you use the same value every time you redeploy.

### 6. Redis connection refused

Error: `Error: connect ECONNREFUSED`.

**Fix:** Use the **Internal** Redis URL. The external URL only works from outside Render. Also confirm the Redis service status is **Available**.

### 7. Worker not processing jobs

Emails are queued but never sent.

**Fix:** Check that the worker's `REDIS_URL` is identical to the backend's `REDIS_URL`. Both must point to the same Redis instance. Also check worker Render logs for startup errors.

### 8. Free tier services take 30+ seconds to respond

Render free services spin down after 15 minutes of inactivity. The first request after a sleep period wakes the service, which takes about 30 seconds.

**Fix:** This is expected on the free tier. For consistent response times, upgrade to the Starter plan. Alternatively, use a cron job or uptime monitor (e.g., UptimeRobot's free tier) to ping `/health` every 10 minutes.

### 9. Encryption key error at startup

Error: `ENCRYPTION_KEY must be a 64-character hex string (32 bytes)`.

**Fix:** Generate the key correctly:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
The output is exactly 64 characters. Copy the full output with no extra spaces or newlines.

### 10. Bull Board returns 403 Forbidden

**Fix:** `ADMIN_EMAIL` must exactly match the email address you use to sign in with Google OAuth. It is case-sensitive. After updating the env var, redeploy the backend and log in again.

---

## Section 12: Free Tier Limitations

| Limitation | Detail |
|------------|--------|
| Service sleep | Free Web Services and Workers spin down after 15 min of inactivity. Cold start takes ~30 s. |
| PostgreSQL storage | 1 GB included. Database is deleted after 90 days of inactivity. |
| PostgreSQL connections | Up to 97 connections on the free tier. |
| Redis storage | 25 MB. No persistence — data is lost on restart. |
| Build minutes | 400 build-minutes/month on the free tier (shared across all services). |
| Bandwidth | 100 GB/month outbound on the free tier. |

### Upgrading for production use

If you need reliable uptime and persistent data, upgrade to Render's **Starter** plan:

- Web Service / Worker: $7/month each
- PostgreSQL: $7/month (90-day auto-delete removed, persistent storage)
- Redis: $10/month (256 MB, with persistence)

Total for all 5 services on Starter: approximately $38/month.

---

## Quick-Reference: All Commands

### Generate secrets locally

```bash
# SESSION_SECRET (32+ chars)
openssl rand -hex 32

# ENCRYPTION_KEY (exactly 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Verify backend locally before deploying

```bash
cd apps/backend
npm run build          # TypeScript compile
npm run typecheck      # Type check without emit
npm run test           # Run Vitest tests
```

### Check deployment health after going live

```bash
# Backend health
curl https://reachinbox-backend.onrender.com/health

# Expected response:
# {"status":"ok"}
```

---

*Generated for ReachInbox — Render deployment configuration created in commit `feat: production deployment config for Render`.*
