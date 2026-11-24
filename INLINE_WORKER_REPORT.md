# Inline BullMQ Worker — Implementation Report (AWAITING APPROVAL)

No git add/commit/push was performed. No deploy. `.env` was not modified. `apps/worker` was not modified. No existing test was modified.

---

## 1. Files changed

### NEW: `apps/backend/src/worker/email.processor.ts`
- Copy of the worker's email-processor logic, using **backend imports only** (no cross-package imports).
- Imports: `prisma` from `../config/database`, `emailService` from `../services/email.service`, `rateLimitService` from `../services/rateLimit.service`, `elasticsearchService` from `../services/elasticsearch.service`, `slackService` from `../services/slack.service`, `logger` from `../utils/logger`, `EmailJobPayload` from `../shared-index`, `Job` from `bullmq`.
- All 6 steps preserved: (1) idempotency check on a committed `SENT` delivery log, (2) `PROCESSING` status + `attempt` increment, (3) global hourly rate limit (atomic Lua), (4) per-sender hourly rate limit, (5) fetch `SenderAccount`, (6) send + atomic persist.
- Both DB transactions identical (success and failure paths); campaign-completion logic preserved (`sentCount >= totalRecipients` → `COMPLETED`; `sent+failed >= total` → `COMPLETED` on failure).
- Re-throw on send failure preserved so BullMQ retry logic runs.
- **One adaptation vs. the worker**: the call is `emailService.sendEmail({ senderAccount, ... })` instead of `{ sender, ... }`, because the backend `EmailService` names that parameter `senderAccount` (the worker's names it `sender`). Behaviour is identical — both build a nodemailer transporter from the sender account and send.

### NEW: `apps/backend/src/worker/inline-worker.ts`
- `startInlineWorker(): Promise<Worker | null>` — starts a BullMQ `Worker` on queue `email-queue` only when `process.env.ENABLE_INLINE_WORKER === 'true'`. Otherwise logs `Inline worker disabled — set ENABLE_INLINE_WORKER=true to enable` and returns `null`. Uses `config.workerConcurrency` and the backend's `redisOptions` (host/port object) for the connection. `bullmq`, `../config/queue`, and `./email.processor` are loaded via dynamic `import()` so the disabled path stays cheap.
- `closeInlineWorker(worker, drainTimeoutMs = 10_000)` — drains in-flight jobs via `worker.close()` racing a 10s timeout; on timeout it force-closes with `worker.close(true)`. No-op when `null`. Attaches `completed`/`failed`/`error`/`stalled` handlers.
- **Deviation from the literal plan (flagged for approval):** the plan inlined this logic directly in `index.ts`. I extracted it into a small module so the requested startup / disabled-mode / graceful-shutdown tests can run without triggering `index.ts`'s `main()` side-effects on import. Runtime behaviour is identical and the `index.ts` change is smaller/surgical.

### MODIFIED: `apps/backend/src/index.ts` (+14 lines, purely additive)
- Added `import { startInlineWorker, closeInlineWorker } from './worker/inline-worker';`
- After the HTTP server starts: `const inlineWorker = await startInlineWorker();`
- `shutdown()` now closes the inline worker **first** (`await closeInlineWorker(inlineWorker)`), then `server.close(...)` → `prisma.$disconnect()` → `redis.disconnect()` → `exit`. The existing 15s force-exit `setTimeout(...).unref()` is unchanged.

### NEW: `apps/backend/src/__tests__/inline-worker.test.ts` (15 tests)
- `startInlineWorker`: disabled when env unset; disabled when `'false'`; starts a Worker bound to `email-queue` with `config.workerConcurrency` when `'true'`.
- `closeInlineWorker`: no-op when `null`; calls `worker.close()`; force-closes (`close(true)`) when draining exceeds the timeout.
- `processEmailJob`: idempotency skip; `PROCESSING` marking; global rate-limit deferral (`moveToDelayed` + `RATE_LIMITED` + Slack); sender rate-limit deferral; `SenderAccount not found` throw; success path (SENT log, recipient SENT, job COMPLETED, campaign `sentCount` increment, ES index); campaign `COMPLETED` when `sentCount` reaches `totalRecipients`; failure path (FAILED log, recipient FAILED, job FAILED, re-throw, no ES index); campaign `COMPLETED` when all recipients processed on failure.

### NOT touched
- `apps/worker/**` — unchanged; still compiles (see §2). Remains the canonical entry point for a paid background-worker deployment.
- `.env` — unchanged.
- All existing tests (`auth`, `campaign`, `emailParser`, `idempotency`, `rateLimit`) — unchanged; all still pass (see §3).

---

## 2. TypeScript check results (exit codes)

Run via WSL Ubuntu, Node v20.20.2, `node_modules/typescript/bin/tsc`.

| Check | Command | Exit |
|---|---|---|
| Backend | `tsc --project apps/backend/tsconfig.json` | **0** (no errors) |
| Worker | `tsc --project apps/worker/tsconfig.json` | **0** (unchanged, still compiles) |

Note: `apps/backend/tsconfig.json` excludes `src/__tests__`, so test files are not part of the build type-check (they are exercised by vitest via esbuild).

---

## 3. Test results (`vitest --run`)

Backend full suite — all pass, **0 failed**:

| Test file | Tests |
|---|---|
| `src/__tests__/idempotency.test.ts` | 10 passed |
| `src/__tests__/emailParser.test.ts` | 26 passed |
| `src/__tests__/rateLimit.test.ts` | 9 passed |
| `src/__tests__/inline-worker.test.ts` | 15 passed (NEW) |
| `src/__tests__/auth.test.ts` | 3 passed |
| `src/__tests__/campaign.test.ts` | 5 passed |
| **Total** | **6 files, 68 passed, 0 failed** (exit 0) |

Existing tests (53) are unchanged and still pass; the new file adds 15.

---

## 4. Exact Render environment variables to add

Add these in the Render dashboard for the backend web service (do **not** edit `.env`):

- `ENABLE_INLINE_WORKER=true`
- `WORKER_CONCURRENCY=2`  ← recommended for the Render free 512 MB tier

`WORKER_CONCURRENCY` and `WORKER_MAX_RETRIES` already exist in the backend config (`apps/backend/src/config/index.ts`) with defaults `5` and `3`. `WORKER_MAX_RETRIES` drives the queue's `attempts`/backoff (already wired in `config/queue.ts`); no change needed.

To roll back: set `ENABLE_INLINE_WORKER=false` (or unset it). The inline worker then never starts and the process behaves exactly as it does today.

---

## 5. Memory estimate (Render free, 512 MB)

- **Disabled (default):** no BullMQ Worker is created; zero added memory. App behaves exactly as today.
- **Enabled (`ENABLE_INLINE_WORKER=true`, `WORKER_CONCURRENCY=2`):** one extra ioredis connection for the Worker (~1–3 MB) plus up to `concurrency` in-flight job coroutines. The heavy singletons (Prisma, the queue's Redis connection, the ES client, Express/Passport) are already loaded by the API, so the marginal overhead is modest — on the order of tens of MB beyond the current API footprint, well within 512 MB at `WORKER_CONCURRENCY=2`. BullMQ keeps `removeOnComplete: { count: 1000 }` / `removeOnFail: { count: 5000 }`, so Redis memory stays bounded. Keep `WORKER_CONCURRENCY` low (2) on the free tier; a slow SMTP send holds a concurrency slot, but the API still serves requests.

---

## 6. Remaining concerns / notes

- **Duplicate-delivery safety** relies on the processor's idempotency check (a committed `SENT` `EmailDeliveryLog`, enforced by `@@unique([emailJobId, status])`), **not** on BullMQ exactly-once. If a worker crashes *after* SMTP accepts the message but *before* the `SENT` log commits, a retry re-sends and the idempotency check does not catch it. This is the same behaviour as the existing standalone worker — no regression — but it is an inherent limitation worth knowing.
- **One-process design:** API and worker share the same Prisma/Redis/ES singletons. This is the goal (zero added infra), but it means a runaway job can consume resources the API also needs. `WORKER_CONCURRENCY=2` keeps this bounded.
- **Future paid plan:** leave `ENABLE_INLINE_WORKER` unset on the web service and deploy `apps/worker` as the Render Background Worker. Queue name (`email-queue`) and processor logic are identical, so no migration is needed. **Do not** run both the inline worker and the background worker against the same queue simultaneously — that would multiply processing attempts (the idempotency check mitigates but does not eliminate redundant work).
- **Plan deviation:** the plan placed the worker lifecycle inline in `index.ts`; I extracted `inline-worker.ts` for testability (so the startup/disabled/shutdown tests can run without `main()` side-effects). Runtime behaviour is identical. If you prefer the literal inline version, I can fold it back, but the tests would then need a different strategy.

Waiting for approval before any push/deploy.
