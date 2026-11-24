# ReachInbox — Render Manual Deployment Guide

## Overview

This guide walks you through deploying ReachInbox on Render **entirely through the Render Dashboard** — no Blueprint, no `render.yaml` required at runtime.

You will create five services in this order:

| # | Service name | Render type | Root dir |
|---|-------------|-------------|---------|
| 1 | `reachinbox-db` | PostgreSQL | — |
| 2 | `reachinbox-redis` | Redis | — |
| 3 | `reachinbox-backend` | Web Service | `apps/backend` |
| 4 | `reachinbox-worker` | Background Worker | `apps/worker` |
| 5 | `reachinbox-frontend` | Web Service | `apps/frontend` |

**Architecture:**

```
Browser → Frontend (Next.js, port 3000)
               ↓ rewrites /api/*
         Backend API (Express, Render-assigned PORT)
               ↓                    ↓
         PostgreSQL             Redis
               ↓
         Worker (BullMQ, no HTTP port)
```

**Estimated setup time:** 30–45 minutes  
**Cost:** Free tier is enough to get started. All five services can run on Render's free plan.

---

## Prerequisites

- A GitHub account with this repo pushed (public, or Render connected to your private repo).
- A Render account at [render.com](https://render.com).
- A Google Cloud Console project with OAuth 2.0 credentials (for login).
- (Optional) A Slack app at [api.slack.com/apps](https://api.slack.com/apps) for Slack integration.
- Local Node.js installed (only to generate secrets — see Step 0).

---

## Step 0: Generate Secrets Locally

Run these commands in your terminal **before** deploying. Copy the output — you will paste these values into Render's dashboard.

### SESSION_SECRET (any 32+ character random string)

```bash
# Option A — openssl (macOS/Linux/WSL):
openssl rand -hex 32

# Option B — Node.js (Windows):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output: `a3f8c2d1e5b4a9f0c8d7e6b5a4f3c2d1e0b9a8f7c6d5e4b3a2f1c0d9e8b7a6`

### ENCRYPTION_KEY (must be exactly 64 hex characters = 32 bytes)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output: `0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1`

> **Important:** Save both values in a password manager. You must use the **same** `ENCRYPTION_KEY` on both the backend and the worker. If you change it after deployment, all stored SMTP passwords become unreadable.

---

## Step 1: Create PostgreSQL Database

1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **PostgreSQL**.
2. Fill in:
   - **Name:** `reachinbox-db`
   - **Database:** `reachinbox`
   - **User:** `reachinbox`
   - **Region:** Choose the same region you will use for all other services (e.g. Oregon US West).
   - **Plan:** Free (or Starter for production).
3. Click **Create Database**.
4. Wait for status to show **Available** (usually 1–2 minutes).
5. On the database's info page, copy the **Internal Database URL**. It looks like:  
   `postgresql://reachinbox:RANDOMPASSWORD@dpg-XXXXX-a/reachinbox`  
   Save this as `DATABASE_URL`. You will paste it into the backend and worker env vars.

> Use the **Internal URL** (not the External URL) for backend and worker. It is faster and free within Render's network.

---

## Step 2: Create Redis

1. Click **New +** → **Redis**.
2. Fill in:
   - **Name:** `reachinbox-redis`
   - **Region:** Same region as PostgreSQL.
   - **Plan:** Free.
3. Click **Create Redis**.
4. Wait for status to show **Available**.
5. Copy the **Internal Redis URL**. It looks like:  
   `redis://red-XXXXX:6379`  
   Save this as `REDIS_URL`.

---

## Step 3: Deploy the Backend API

### 3.1 Create Web Service

1. Click **New +** → **Web Service**.
2. Connect your GitHub repo.
3. Fill in:
   - **Name:** `reachinbox-backend`
   - **Region:** Same as database.
   - **Branch:** `main` (or your production branch).
   - **Root Directory:** `apps/backend`
   - **Runtime:** Node
   - **Build Command:**
     ```
     npm install && npm run build
     ```
   - **Start Command:**
     ```
     npm run start:prod
     ```
     *(This runs `npx prisma migrate deploy && node dist/index.js` — migrations run automatically on every deploy before the server starts.)*
   - **Plan:** Free.
4. Click **Create Web Service** (do NOT deploy yet — set env vars first).

### 3.2 Set Environment Variables

Go to the service's **Environment** tab and add these variables one by one:

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NODE_ENV` | `production` | Yes | |
| `DATABASE_URL` | Paste from Step 1 | Yes | Use Internal URL |
| `REDIS_URL` | Paste from Step 2 | Yes | Use Internal URL |
| `PORT` | *(do NOT set)* | — | Render injects this automatically |
| `SESSION_SECRET` | Generated in Step 0 | Yes | Must be 32+ chars. Keep the same value across all redeploys |
| `ENCRYPTION_KEY` | Generated in Step 0 | Yes | Must be exactly 64 hex chars. Must match worker's value |
| `CORS_ORIGIN` | `https://reachinbox-frontend.onrender.com` | Yes | Use your actual frontend URL. Set after Step 5 is deployed. For now use a placeholder and update later |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console | Yes | Required for login |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console | Yes | Required for login |
| `GOOGLE_CALLBACK_URL` | `https://reachinbox-backend-in0o.onrender.com/api/auth/google/callback` | Yes | Replace with your actual backend URL |
| `SLACK_CLIENT_ID` | From api.slack.com/apps | No | App works without Slack |
| `SLACK_CLIENT_SECRET` | From api.slack.com/apps | No | |
| `SLACK_REDIRECT_URI` | `https://reachinbox-backend-in0o.onrender.com/api/slack/callback` | No | Replace with your actual backend URL |
| `ELASTICSEARCH_URL` | From Bonsai or leave empty | No | Search degrades to DB queries if missing |
| `ADMIN_EMAIL` | Your Google login email | Yes | This email gets access to Bull Board at `/admin/queues` |
| `GLOBAL_HOURLY_LIMIT` | `100` | Yes | |
| `SENDER_HOURLY_LIMIT` | `50` | Yes | |
| `API_HOST` | `0.0.0.0` | Yes | Must bind to all interfaces on Render |

> **Note:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are optional at app startup (the server starts without them), but users will get an error when they try to log in if these are missing. Set them before testing login.

### 3.3 Trigger Deploy and Verify

1. Click **Manual Deploy** → **Deploy latest commit**.
2. Watch the **Logs** tab. A successful start looks like:
   ```
   Running migrations...
   Prisma connected to database
   Redis ready
   ReachInbox API server started { host: '0.0.0.0', port: 10000, env: 'production' }
   ```
3. Visit your backend health check URL:
   ```
   https://reachinbox-backend-in0o.onrender.com/health
   ```
   Expected response:
   ```json
   { "status": "ok", "uptime": 12.3 }
   ```
   If you see this, the backend is running correctly.

---

## Step 4: Deploy the Worker

### 4.1 Create Background Worker

1. Click **New +** → **Background Worker**.
2. Connect your GitHub repo (same repo).
3. Fill in:
   - **Name:** `reachinbox-worker`
   - **Region:** Same as database.
   - **Branch:** `main`.
   - **Root Directory:** `apps/worker`
   - **Runtime:** Node
   - **Build Command:**
     ```
     npm install && npm run build
     ```
   - **Start Command:**
     ```
     npm run start
     ```
   - **Plan:** Free.
4. Click **Create Background Worker** (set env vars before first deploy).

### 4.2 Set Environment Variables

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NODE_ENV` | `production` | Yes | |
| `DATABASE_URL` | Same as backend | Yes | Use Internal URL |
| `REDIS_URL` | Same as backend | Yes | Use Internal URL |
| `ENCRYPTION_KEY` | Same as backend | Yes | Must be identical to backend's value |
| `GLOBAL_HOURLY_LIMIT` | `100` | Yes | |
| `SENDER_HOURLY_LIMIT` | `50` | Yes | |
| `WORKER_CONCURRENCY` | `2` | Yes | Use 2 on the free tier (512 MB RAM). Increase to 5 on paid plans |
| `WORKER_MAX_RETRIES` | `3` | Yes | |
| `ELASTICSEARCH_URL` | Same as backend if set | No | |

### 4.3 Trigger Deploy and Verify

1. Click **Manual Deploy** → **Deploy latest commit**.
2. In the **Logs** tab, you should see:
   ```
   Worker started, concurrency: 2, queue: email-queue
   ```
3. The worker does not expose an HTTP port — there is no URL to visit. As long as it stays running without crashing, it is working.

---

## Step 5: Deploy the Frontend

### 5.1 Create Web Service

1. Click **New +** → **Web Service**.
2. Connect the same GitHub repo.
3. Fill in:
   - **Name:** `reachinbox-frontend`
   - **Region:** Same region.
   - **Branch:** `main`.
   - **Root Directory:** `apps/frontend`
   - **Runtime:** Node
   - **Build Command:**
     ```
     npm install && npm run build
     ```
   - **Start Command:**
     ```
     npm run start
     ```
   - **Plan:** Free.

### 5.2 Set Environment Variables

> **Critical:** `NEXT_PUBLIC_API_URL` is baked into the JavaScript bundle at **build time** by Next.js. If you deploy without this variable, all API calls from the browser will go to `localhost:3001` and fail. You must set it **before the first build**.

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://reachinbox-backend-in0o.onrender.com` | Yes | Replace with your actual backend URL. Set BEFORE the first build. If you need to change it later, you must trigger a new build |
| `NODE_ENV` | `production` | Yes | |

### 5.3 Trigger Deploy and Verify

1. Click **Manual Deploy** → **Deploy latest commit**.
2. Wait for the build to finish (2–4 minutes for Next.js).
3. Visit your frontend URL:
   ```
   https://reachinbox-frontend.onrender.com
   ```
   You should see the ReachInbox login page.

---

## Step 6: Update OAuth Callback URLs

After all services are deployed, you must register the production callback URLs in the OAuth provider dashboards. Render assigns unique URLs per service.

### 6.1 Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Click on your OAuth 2.0 Client ID.
3. Under **Authorized redirect URIs**, add:
   ```
   https://reachinbox-backend-in0o.onrender.com/api/auth/google/callback
   ```
4. Under **Authorized JavaScript origins**, add:
   ```
   https://reachinbox-frontend.onrender.com
   ```
5. Click **Save**.
6. Make sure `GOOGLE_CALLBACK_URL` on the backend matches this exact URL (including `/api/auth/google/callback`).

### 6.2 Slack OAuth (Optional)

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Select your app.
2. Go to **OAuth & Permissions** → **Redirect URLs** → Add:
   ```
   https://reachinbox-backend-in0o.onrender.com/api/slack/callback
   ```
3. Click **Save URLs**.
4. Make sure `SLACK_REDIRECT_URI` on the backend matches this exact URL.

---

## Step 7: Configure CORS

The backend's `CORS_ORIGIN` must match the frontend URL exactly (no trailing slash).

1. Go to your `reachinbox-backend` service → **Environment**.
2. Set `CORS_ORIGIN` to your frontend URL:
   ```
   https://reachinbox-frontend.onrender.com
   ```
   (Replace with your actual frontend URL from Render's dashboard.)
3. Click **Save Changes** — this will trigger a redeploy.

After the backend redeploys, test by visiting the frontend and opening the browser's DevTools → Network tab. API calls should not show CORS errors.

---

## Step 8: Final Verification Checklist

Work through each item. All should pass before you share the app.

- [ ] `https://YOUR-BACKEND.onrender.com/health` returns `{"status":"ok",...}`
- [ ] `https://YOUR-FRONTEND.onrender.com` shows the login page (no blank screen)
- [ ] Clicking "Sign in with Google" redirects to Google and returns to the frontend
- [ ] After login, the dashboard loads without errors in the browser console
- [ ] Creating a sender account saves without errors
- [ ] Creating a campaign and uploading recipients works
- [ ] Launching a campaign queues jobs (check backend logs for `Job queued`)
- [ ] Worker logs show `Job completed` within a few seconds of launching a campaign
- [ ] `https://YOUR-BACKEND.onrender.com/admin/queues` redirects to login if not authenticated, and shows Bull Board after logging in with the `ADMIN_EMAIL` account
- [ ] No CORS errors in the browser console

---

## Environment Variables Reference

Complete reference — use this when setting up each service on Render.

### Backend (`apps/backend`)

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NODE_ENV` | `production` | Yes | |
| `DATABASE_URL` | From Render PostgreSQL → Internal URL | Yes | Starts with `postgresql://` |
| `REDIS_URL` | From Render Redis → Internal URL | Yes | Starts with `redis://` |
| `PORT` | *(do NOT set)* | — | Render injects this. App reads `PORT` automatically |
| `SESSION_SECRET` | Generate with `openssl rand -hex 32` | Yes | 32+ chars. Must be stable across redeploys |
| `ENCRYPTION_KEY` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Yes | Exactly 64 hex chars. Must match worker |
| `CORS_ORIGIN` | `https://YOUR-FRONTEND.onrender.com` | Yes | No trailing slash. Update after frontend deploys |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console | Yes | OAuth login requires this |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console | Yes | |
| `GOOGLE_CALLBACK_URL` | `https://YOUR-BACKEND.onrender.com/api/auth/google/callback` | Yes | Must match Google Console redirect URI |
| `SLACK_CLIENT_ID` | From api.slack.com/apps | No | App works without Slack |
| `SLACK_CLIENT_SECRET` | From api.slack.com/apps | No | |
| `SLACK_REDIRECT_URI` | `https://YOUR-BACKEND.onrender.com/api/slack/callback` | No | Must match Slack app redirect URI |
| `ELASTICSEARCH_URL` | From Bonsai or leave empty | No | Search degrades to DB if missing |
| `ADMIN_EMAIL` | Your Google login email | Yes | Grants access to `/admin/queues` (Bull Board) |
| `GLOBAL_HOURLY_LIMIT` | `100` | Yes | Max emails per hour across all senders |
| `SENDER_HOURLY_LIMIT` | `50` | Yes | Max emails per hour per sender account |
| `API_HOST` | `0.0.0.0` | Yes | Must bind to all interfaces (required on Render) |

### Worker (`apps/worker`)

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NODE_ENV` | `production` | Yes | |
| `DATABASE_URL` | Same as backend | Yes | Use Internal URL |
| `REDIS_URL` | Same as backend | Yes | Use Internal URL |
| `ENCRYPTION_KEY` | Same as backend | Yes | Must be identical — used to decrypt SMTP passwords |
| `GLOBAL_HOURLY_LIMIT` | `100` | Yes | |
| `SENDER_HOURLY_LIMIT` | `50` | Yes | |
| `WORKER_CONCURRENCY` | `2` | Yes | Free tier: 2. Paid: 5 |
| `WORKER_MAX_RETRIES` | `3` | Yes | |
| `ELASTICSEARCH_URL` | Same as backend | No | |

### Frontend (`apps/frontend`)

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-BACKEND.onrender.com` | Yes | **Set BEFORE first build.** This value is baked into the JS bundle at build time by Next.js. Changing it requires a new build |
| `NODE_ENV` | `production` | Yes | |

---

## Elasticsearch (Optional)

Elasticsearch enables full-text search across campaigns and recipients. If `ELASTICSEARCH_URL` is not set, the app falls back to database queries and continues working normally.

### Free setup with Bonsai

1. Create a free account at [bonsai.io](https://bonsai.io).
2. Create a cluster (Hobby plan is free).
3. Copy the cluster URL (includes credentials): `https://user:pass@your-cluster.us-east-1.bonsaisearch.net`
4. Set this as `ELASTICSEARCH_URL` on both backend and worker.

---

## Troubleshooting

### "Application failed to respond" on Render

The app crashed before binding to the port. Check **Logs**. Most common causes:
- Missing required env var (`DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, or `ENCRYPTION_KEY`).
- `ENCRYPTION_KEY` is not exactly 64 hex characters.
- Database migrations failed — check for migration errors in the logs.

### CORS error in browser console

`Access-Control-Allow-Origin` is wrong or missing.
- Check that `CORS_ORIGIN` on the backend exactly matches your frontend URL.
- No trailing slash: `https://app.onrender.com` not `https://app.onrender.com/`.
- After changing `CORS_ORIGIN`, wait for the backend to redeploy.

### "redirect_uri_mismatch" on Google login

The callback URL in Google Cloud Console does not match what the backend sends.
- Check `GOOGLE_CALLBACK_URL` on the backend: it must be `https://YOUR-BACKEND.onrender.com/api/auth/google/callback`.
- In Google Cloud Console, the same URL must be in **Authorized redirect URIs**.
- URLs are case-sensitive and must have no trailing slash.

### Session not persisting (logged out after every page refresh)

- `SESSION_SECRET` is different between deploys or missing.
- Redis is not connected — check backend logs for `Redis connection error`.
- The session cookie's `SameSite=Strict` can block cross-origin cookies if frontend and backend are on different domains. All `/api/*` routes are proxied through the Next.js frontend, so this should not occur — but verify the rewrites in `next.config.js` are reaching the backend.

### Worker not processing jobs

- Check worker logs for errors.
- Confirm `REDIS_URL` and `DATABASE_URL` on the worker match the backend.
- Confirm `ENCRYPTION_KEY` on the worker is identical to the backend's value. A mismatch causes SMTP password decryption to fail and jobs to error.
- Try reducing `WORKER_CONCURRENCY` to `1` on the free tier to avoid OOM.

### "Invalid environment configuration" on startup

The Zod schema validation failed. The error message in the logs names the missing or invalid variable. The most common causes:
- `ENCRYPTION_KEY` is not exactly 64 hex characters (128 bits = 32 bytes = 64 hex chars).
- `SESSION_SECRET` is shorter than 32 characters.
- `DATABASE_URL` or `REDIS_URL` is empty.

### Database migration error on deploy

- If you see `P3005` or migration conflicts, the database has schema drift.
- Do not use `prisma migrate dev` on a production database — it is for local development only.
- For the first deploy, `prisma migrate deploy` creates all tables from your migration history.
- If needed, connect to the Render PostgreSQL database using an external tool (e.g., TablePlus) and inspect the state.

### Frontend shows blank page or "Internal Server Error"

- `NEXT_PUBLIC_API_URL` was not set before the build. Redeploy the frontend after setting it.
- Check the browser console for the actual error.
- Check the frontend service logs on Render for Next.js startup errors.

### Bull Board `/admin/queues` returns 403 Forbidden

- You are logged in but your account email does not match `ADMIN_EMAIL`.
- `ADMIN_EMAIL` must exactly match the email address of your Google account (case-sensitive).
- After updating `ADMIN_EMAIL`, the backend must redeploy.

### "Service Unavailable" after a few minutes

- Free tier services on Render **spin down after 15 minutes of inactivity**. The first request after spin-down takes 30–60 seconds to respond.
- To avoid this, upgrade to a Starter plan or use an external uptime monitor (e.g., UptimeRobot with a free ping to your `/health` endpoint every 5 minutes).

### Slack OAuth callback fails

- `SLACK_REDIRECT_URI` on the backend must match the redirect URL registered in your Slack app's **OAuth & Permissions** page.
- Confirm both values are identical, including the path `/api/slack/callback`.

---

## Free Tier Limitations & Upgrade Path

| Limitation | Free Tier | Solution |
|------------|-----------|---------|
| Services spin down after 15 min of inactivity | Yes | Upgrade to Starter ($7/month) or use an uptime monitor to keep it awake |
| PostgreSQL storage | 1 GB | Upgrade to Basic PostgreSQL ($7/month) for 10 GB |
| Redis memory | 25 MB | Upgrade to Starter Redis ($10/month) for 100 MB |
| Build minutes | 500/month per account | Usually enough for small projects |
| Bandwidth | 100 GB/month | Enough for most use cases |
| Custom domains | Supported on all plans | Add via service Settings → Custom Domains |

### Upgrade path for production

1. Upgrade PostgreSQL to **Starter** (adds persistent storage and backups).
2. Upgrade Redis to **Starter** (adds more memory for session storage and job queues).
3. Upgrade backend and worker web services to **Starter** (prevents sleep, adds more RAM).
4. Set a custom domain in **Settings → Custom Domains** for each service.
5. Increase `WORKER_CONCURRENCY` to 5 after upgrading worker RAM.
