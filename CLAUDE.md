# LodgeMart — project guide & progress log

Campus batch foodstuff delivery for UNIZIK students: Eke Awka market vendors → one rider per batch →
campus pickup hubs, with PIN handover, roommate delegation, and line-item vendor ratings.

- **Frontend** (repo root: `src/`, Vite + React) — owned by Chidi. Deployed to Vercel (lodge-mart.vercel.app).
- **Backend** (`server/`, Node + Express) — owned by the backend dev. Holds all API keys/secrets.
- **Source of truth for behaviour:** the prototype logic in `src/context/LodgeMartContext.jsx`
  (decision 2026-11-27: follow the prototype, not the original written story, where they differ).

## Working rules

1. **Phase-gated ("engineering loop").** Each phase is built, tested (automated + manual), and passes the
   security checklist below before the next phase starts. One commit per verified phase.
2. **Server decides anything involving money.** Prices, totals, PINs, payouts, rider earnings and order
   status transitions are computed server-side. Never trust amounts sent by the client.
3. **Money is integer kobo** (₦1 = 100 kobo) everywhere in the backend.
4. **Secrets live only in `server/.env`** (gitignored). `server/.env.example` lists every variable with
   blank values. `server/.env.test` holds local-docker test values only — no real secrets, ever.
5. Branch per phase (`backend/phase-N-...`), PR into `master`.

## Security checklist (every phase must pass the items that apply)

| # | Requirement | How it's handled |
|---|---|---|
| 1 | Remove unused packages | Review `server/package.json` each phase; `npx depcheck` before commit |
| 2 | No secrets in git | `.env*` gitignored (except `.env.example`, `.env.test`); scan staged diff before each commit |
| 3 | Rate limiting | Redis-backed limits on auth, PIN handover and write endpoints (Phase 2+) |
| 4 | Password hashing | bcrypt, cost 12; plaintext never stored or logged |
| 5 | User access checks | Every route checks role **and** ownership (a student only sees their own orders, etc.) |
| 6 | Hide API keys | Keys only in server env; never sent to the frontend; logger redacts auth headers |
| 7 | Proper authentication | JWT (short expiry) + Redis revocation on logout; `/me` endpoint |
| 8 | Dependencies up to date | `npm outdated` + `npm audit` each phase; fix highs/criticals |
| 9 | Sanitize form input | zod validation on every body/param/query; strict schemas reject unknown fields |
| 10 | XSS protection | API returns JSON only; helmet CSP; inputs validated/trimmed; frontend renders via React (escaped) |
| 11 | Env variables checked | zod schema in `server/src/config/env.js`; server refuses to boot if invalid |
| 12 | No exposed files | No static file serving from the API; `.env`, dumps, backups gitignored; check `git ls-files` |
| 13 | Admin routes protected | `requireRole('ADMIN')` on all `/api/admin/*` |
| 14 | Secure API endpoints | Auth middleware by default; explicit public allow-list (health, catalog, login, register, webhook) |
| 15 | CORS | Only origins in `CLIENT_URL`; others get 403 |
| 16 | Security headers | helmet; `x-powered-by` disabled |
| 17 | Secure DB access | Prisma only (parameterised); no raw SQL with user input; least-privilege DB user in production |
| 18 | No mistakes | Tests per phase + manual run + this checklist before every commit |

## Local setup (backend)

```bash
cd server
cp .env.example .env          # then fill JWT_SECRET (command in the file)
npm install
npm run db:up                 # Postgres on :5433, Redis on :6379 (docker)
npm run db:migrate            # apply migrations
npm run db:seed               # load prototype sample data
npm run dev                   # http://localhost:4000/api/health
npm test                      # runs against lodgemart_test database
```

Sandbox logins (seeded, password `password123`): chinedu.unizik@gmail.com (student),
ogaemeka@lodgemart.ng / mamangozi@lodgemart.ng (vendor), tunde.dispatch@lodgemart.ng (rider), ops@lodgemart.ng (admin).

## Phase plan & progress

| Phase | Scope | Status |
|---|---|---|
| 1 | Setup: Express, Prisma schema, Postgres+Redis (docker), env validation, helmet, CORS, error format, seed, `/api/health`, tests | ✅ Verified 2026-11-27 — 14/14 tests, manual run, 0 audit vulns |
| 2 | Auth: register/login/logout/me, JWT, bcrypt, role + ownership middleware, Redis rate limits | ✅ Verified 2026-11-27 — 42/42 tests, manual run, 0 audit vulns |
| 3 | Catalog + orders: server-side routing (transaction, no overselling), my orders, cancel, delegate PIN | ✅ Verified 2026-11-27 — 80/80 tests (×3 runs), manual run, 0 audit vulns |
| 4 | Vendor + rider: packing, stall pickup (per batch), hub arrival, PIN handover (single-use, rate-limited) | ✅ Verified 2026-11-28 — 111/111 tests, manual run, 0 audit vulns |
| 5 | Paystack (test mode): initialize, webhook (signature + idempotency), vendor transfers; photo upload | 🟨 Built 2026-11-28 — 137/137 tests (Paystack mocked), manual run without keys OK, 0 audit vulns. **Pending: manual run with real Paystack TEST keys + Cloudinary** |
| 6 | Ratings + admin summary | ⬜ |
| 7 | API docs for Chidi; frontend wiring support; deploy API (Render/Railway) | ⬜ |

## Backend folder layout (`server/src/`)

Standard Express layout — keep new code in this shape:
- `routes/` — `xxxRoutes.js`: URL → middleware → controller. No logic.
- `controllers/` — `xxxController.js`: read `req`, call a service, send `res`.
- `services/` — `xxxService.js`: business logic + Prisma queries (money, status rules live here).
- `middleware/` — `authMiddleware.js` (authenticate, `requireRole`, `assertOwnerOrAdmin`, **PUBLIC_ROUTES allow-list**),
  `rateLimitMiddleware.js`, `validateMiddleware.js`, `errorMiddleware.js`.
- `utils/` — zod schemas (`xxxSchema.js`), errors, logger, password helpers.
- `config/` — env validation, Prisma client, Redis client.

**Auth model:** `Authorization: Bearer <jwt>` (HS256, `sub`=user id, `jti` for revocation). Every `/api` route
requires a token unless listed in `PUBLIC_ROUTES`. User is re-loaded from DB per request (disable/role change is
immediate). Public register creates STUDENT only. Redis down → auth answers 503 (fails closed).

## Stack notes (read before touching dependencies)

- **Express 5**, **zod 4**, **Prisma 7.10** (+ `@prisma/adapter-pg`/`pg`), **ioredis**, **pino**, **bcryptjs**; tests: **vitest + supertest**.
- **Prisma 7 specifics:** DB URL lives in `server/prisma.config.js` (not the schema); `PrismaClient` must be
  constructed with the `PrismaPg` adapter (see `server/src/lib/prisma.js`); seed command is in `prisma.config.js`.
- **`overrides.effect = 3.22.5`** in `server/package.json`: patches a high-severity ReDoS (GHSA-7589-6fvf-x4pw)
  in the `effect` version bundled by the Prisma CLI. Remove once Prisma ships a fixed `@prisma/config`.
- Tests never run `prisma migrate reset` (destructive). `tests/globalSetup.js` runs `migrate deploy` + seed,
  and refuses to run unless the DB name is exactly `lodgemart_test`.
- Docker Postgres is on **5433** (a local Postgres already uses 5432).
- **Windows:** run `npm test` from PowerShell / a `C:\` path. From Git Bash (`/c/...` lower-case drive) vitest
  fails with "failed to find the runner" (drive-letter case mismatch).
- `depcheck` flags `pg` as unused — false positive, it's required by `@prisma/adapter-pg`.
- Tests print a pg `DeprecationWarning: client.query() when the client is already executing` — it comes from
  inside `@prisma/adapter-pg` transactions, not our code. Harmless until pg@9; revisit when Prisma updates the adapter.

## Known prototype bugs to fix in the backend

- Stall payout paid for **all** uncollected items regardless of batch → now scoped per vendor/slot/date (unique constraint).
- PIN handover didn't check status → order could be collected twice and rider paid twice → `RiderEarning.orderId` is unique; handover requires `READY_AT_HUB`.
- Routing happened per order at checkout without locking → now in a DB transaction with conditional stock
  decrements (`updateMany ... stockQty >= qty`); a lost race re-routes (max 3 tries) then 409 OUT_OF_STOCK.
- Cancel could refund twice on double-click → status flip is a conditional update; only one request refunds.

## Phase 3 API (for Chidi — full docs in Phase 7)

All money in **kobo**. Errors: `{ error: { code, message, details? } }`.
- `GET /api/catalog` (public) → `{ products[{id,name,unit,category,emoji,studentPriceKobo,kioskComparePriceKobo,inStock}], zones[{id,name,hubs[{id,name}]}], batchSlots[{id,label,startTime,endTime,cutoffTime,badge,nextBatchDate}], fees }`
- `POST /api/orders` (student) body `{ items:[{productId,qty}], zoneId, hubId, batchSlotId, paymentMethod:"WALLET" }`
  → 201 `{ order }` (incl. `pickupPin`, `orderLabel` "#4083"). Errors: 400 validation/INVALID_HUB/INVALID_BATCH_SLOT/
  PRODUCT_UNAVAILABLE, 402 INSUFFICIENT_FUNDS, 409 OUT_OF_STOCK. Client must NOT send prices (rejected).
- `GET /api/orders` (student, own, newest 50) · `GET /api/orders/:id` (owner or admin; admin never sees PIN)
- `POST /api/orders/:id/cancel` (owner; ORDER_PLACED/PACKED_AT_MARKET only) → `{ refundKobo, cancellationFeeKobo }`
- `POST /api/orders/:id/delegate` (owner) body `{ name, phone }` → `{ pickupPin }` (new PIN; old one stops working)

Business constants: `server/src/config/business.js`. Batch date = today if before the slot cutoff (Lagos), else tomorrow.

## Log

- **2026-11-27** — Repo access accepted; branch `backend/phase-1-setup`. Phase 1 scaffolding, schema
  (`server/prisma/schema.prisma`), first migration and seed done; dev DB verified (order #4082 = ₦14,450,
  bcrypt cost 12, next order #4083).
- **2026-11-27 — Phase 1 verified.** 14/14 tests (health, error format, headers, CORS, env validation, seed
  integrity). Manual: health 200, unknown origin 403, Redis stopped → 503 "degraded", auto-recovers.
  Security: `npm audit` 0 vulns (upgraded zod 3→4, Prisma 6→7, `effect` override), depcheck clean
  (removed `jsonwebtoken` until Phase 2), staged-diff secret scan clean, no env/dump files tracked.
- **2026-11-27 — Phase 1 pushed** (`backend/phase-1-setup` on origin; PR not yet opened).
- **2026-11-27 — Phase 2 verified** on `backend/phase-2-auth` (branched from phase 1). Restructured `server/src`
  into routes/controllers/services/middleware/utils/config. Auth: register (student-only, strict schema),
  login (same error for wrong password/unknown email + timing equaliser), logout (Redis `jti` revocation),
  `/me`; Redis rate limits (login 5/15min per email + 30/15min per IP; register 10/h per IP).
  Tests 42/42 (tampered/`alg=none`/expired/revoked tokens, role escalation, disabled accounts, limits).
  Manual: full login→me→logout→401 flow, logs redact Authorization, Redis stopped → 503, recovers.
  `npm audit` 0 vulns; depcheck clean (pg false positive); staged-diff secret scan clean.
- **2026-11-27 — Phase 3 verified** on `backend/phase-3-orders` (branched from phase 2, so it contains phases 1–3).
  Catalog (public, no wholesale/stock/bank leak), wallet orders with prototype routing (single-stop → split by
  rating then wholesale; vendors < 3.5★ or inactive excluded; bag-merge flag), my orders, cancel (₦200 fee, restock,
  refund once), delegate (new PIN). Order writes rate-limited 20/10min per user. Tests 80/80, stable over 3 runs —
  incl. 8 parallel orders for 3 items (exactly 3 succeed), parallel wallet overspend, parallel double-cancel.
  Manual: #4083 placed (₦11,650, split Emeka/Ngozi, next-day batch after cutoff), delegate, cancel → wallet −₦200.
  Fixed flaky setup (hookTimeout 30s; phase 3 creates test users directly). Phases 2–3 not pushed yet (user's call).
- **2026-11-27 — Phase 4 built** on `backend/phase-4-vendor-rider` (worktree `../LodgeMart-backend`, because a
  frontend session switched the shared folder to `frontend/refurbish`). Vendor packing/inventory, rider manifest,
  per-batch stall pickup (pending payouts), hub arrival, PIN handover (5-attempt lock, single use, unique commission).
  111/111 tests ×3, manual run on #4082 OK. Security checklist interrupted (PC shutdown); **see HANDOVER.md**.
- **2026-11-28 — Phase 4 verified.** Finished the interrupted checklist: `npm audit` 0, depcheck clean (pg false
  positive), only `.env.example`/`.env.test` tracked, 111/111 tests, dev data reseeded. Note: first `db:seed` after
  Docker sat idle overnight failed with P2028 "Unable to start a transaction in the given time"; it succeeded on retry
  (nothing was holding locks).
- **2026-11-28 — Phase 5 built** on `backend/phase-5-payments` (from phase 4). Migration `phase5_payments` (additive:
  `PayoutStatus.PROCESSING`, `Vendor.bankCode/paystackRecipientCode`, `StallPickup.payoutAttempts/payoutFailureReason/paidAt`).
  Card checkout (PENDING_PAYMENT holds stock → Paystack initialize; init failure releases stock), webhook
  (HMAC-SHA512 over raw body, amount+currency check, idempotent, late payment → full wallet refund),
  `verify-payment`, 30-min expiry timer, vendor payouts (admin run, atomic claim, new reference per attempt,
  transfer.success/failed/reversed), Cloudinary signed direct upload + pickup photo must be in our folder.
  Env: live `sk_live_` key refused unless NODE_ENV=production. Found+fixed during tests: duplicate transfer-recipient
  creation when one vendor had 2 payouts; cancel-vs-payment race could cancel a just-paid order with ₦0 refund.
  137/137 ×3. Manual (no keys): card → 503, forged webhook → 401, uploads → 503, wallet still works, no secrets in logs.
