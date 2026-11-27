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
| 2 | Auth: register/login/logout/me, JWT, bcrypt, role + ownership middleware, Redis rate limits | ⬜ |
| 3 | Catalog + orders: server-side routing (transaction, no overselling), my orders, cancel, delegate PIN | ⬜ |
| 4 | Vendor + rider: packing, stall pickup (per batch), hub arrival, PIN handover (single-use, rate-limited) | ⬜ |
| 5 | Paystack (test mode): initialize, webhook (signature + idempotency), vendor transfers; photo upload | ⬜ |
| 6 | Ratings + admin summary | ⬜ |
| 7 | API docs for Chidi; frontend wiring support; deploy API (Render/Railway) | ⬜ |

## Stack notes (read before touching dependencies)

- **Express 5**, **zod 4**, **Prisma 7.10** (+ `@prisma/adapter-pg`/`pg`), **ioredis**, **pino**, **bcryptjs**; tests: **vitest + supertest**.
- **Prisma 7 specifics:** DB URL lives in `server/prisma.config.js` (not the schema); `PrismaClient` must be
  constructed with the `PrismaPg` adapter (see `server/src/lib/prisma.js`); seed command is in `prisma.config.js`.
- **`overrides.effect = 3.22.5`** in `server/package.json`: patches a high-severity ReDoS (GHSA-7589-6fvf-x4pw)
  in the `effect` version bundled by the Prisma CLI. Remove once Prisma ships a fixed `@prisma/config`.
- Tests never run `prisma migrate reset` (destructive). `tests/globalSetup.js` runs `migrate deploy` + seed,
  and refuses to run unless the DB name is exactly `lodgemart_test`.
- Docker Postgres is on **5433** (a local Postgres already uses 5432).

## Known prototype bugs to fix in the backend

- Stall payout paid for **all** uncollected items regardless of batch → now scoped per vendor/slot/date (unique constraint).
- PIN handover didn't check status → order could be collected twice and rider paid twice → `RiderEarning.orderId` is unique; handover requires `READY_AT_HUB`.
- Routing happened per order at checkout without locking → must run in a DB transaction to prevent overselling.

## Log

- **2026-11-27** — Repo access accepted; branch `backend/phase-1-setup`. Phase 1 scaffolding, schema
  (`server/prisma/schema.prisma`), first migration and seed done; dev DB verified (order #4082 = ₦14,450,
  bcrypt cost 12, next order #4083).
- **2026-11-27 — Phase 1 verified.** 14/14 tests (health, error format, headers, CORS, env validation, seed
  integrity). Manual: health 200, unknown origin 403, Redis stopped → 503 "degraded", auto-recovers.
  Security: `npm audit` 0 vulns (upgraded zod 3→4, Prisma 6→7, `effect` override), depcheck clean
  (removed `jsonwebtoken` until Phase 2), staged-diff secret scan clean, no env/dump files tracked.
