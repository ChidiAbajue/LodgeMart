# LodgeMart — Handover / Resume Guide

> Written 2026-11-27 when moving to a new PC. Read this first, then `CLAUDE.md` (the running project log).
> On the new PC, open Claude Code in the repo folder and say:
> **"Read HANDOVER.md and CLAUDE.md, then continue Phase 4's remaining checks and start Phase 5."**

---

## 1. What LodgeMart is

Campus batch foodstuff delivery for UNIZIK students:
Eke Awka market vendors → one rider per delivery batch → campus pickup hubs. The student collects
with a 4-digit PIN (or hands the PIN to a roommate). Students rate items line by line, which feeds vendor ratings.

| Part | Where | Owner | Notes |
|---|---|---|---|
| Frontend | repo root `src/` (Vite + React) | Chidi | Deployed on Vercel: lodge-mart.vercel.app |
| Backend API | `server/` (Node + Express + Postgres + Redis) | us (backend dev) | Holds all secrets. Not deployed yet (Phase 7) |
| Prototype logic | `src/context/LodgeMartContext.jsx` | — | **Source of truth for behaviour** (decision 2026-11-27) |

GitHub: **https://github.com/ChidiAbajue/LodgeMart** (Chidi's repo; we push branches to it).

---

## 2. Branches — what each one is

| Branch | Latest commit | Pushed? | Contents |
|---|---|---|---|
| `master` | `632d625` | yes | Original frontend prototype. Nothing merged into it yet. |
| `backend/phase-1-setup` | `050d666` | yes | Phase 1 only |
| `backend/phase-2-auth` | `b8311e5` | yes | Phases 1+2 |
| `backend/phase-3-orders` | `b14d708` | yes | Phases 1+2+3 |
| **`backend/phase-4-vendor-rider`** | (this commit) | yes | **Phases 1–4. ← CONTINUE BACKEND WORK HERE** |
| `frontend/refurbish` | `a637bc1` | yes (pushed at handover) | Frontend redesign: 10 commits made on the old PC (landing, shop, login, my-orders, vendor/rider/admin portals, Vercel config). Branched from `master`. |

**The backend branches stack:** each phase branch was cut from the previous one, so
`backend/phase-4-vendor-rider` already contains phases 1–4. **No merging is needed between them.**
When ready, open **one PR** from the latest backend branch into `master` (or one PR per phase, in order 1 → 2 → 3 → 4).
No PRs have been opened yet. That was the user's decision ("leave it for now").

### Git history (as of handover)

```
* a637bc1 Frontend: .vercelignore keeps server/, env files and screenshots out of preview deploys   (frontend/refurbish)
* a7c1fa0 Frontend: SPA rewrite for Vercel deep links, ignore .vercel, update FRONTEND.md log
* 5dde507 Frontend portals: vendor stall portal, rider dispatch, admin ops dashboard and camera modal
* 0fe6fdc Frontend login + my orders: split-screen sign-in, order cards, flip-in PIN tiles, modals
* 904a3bc Frontend shop: photo header, sticky drop-off bar, category tabs, basket drawer, checkout
* f18c8c1 Frontend landing v3: classic grocery layout from owner's references
* 7ec221e Frontend V1.1: cinematic hero
* 36b9cf2 Frontend V1: bold hero redesign
* 76e2691 Frontend R1: navbar, footer and landing page redesign
* 7b57600 Frontend R0: design tokens, SVG logo, Motion, UI primitives, product photos
| * (this)  Backend phase 4: vendor packing/inventory, rider pickups, hub arrival, PIN handover   (backend/phase-4-vendor-rider)
| * b14d708 Backend phase 3: catalog, wallet orders with server-side routing, cancel, delegate
| * b8311e5 Backend phase 2: auth (register/login/logout/me), JWT + Redis revocation, rate limits
| * 050d666 Backend phase 1: Express API scaffold, Prisma schema, seed, health check
|/
* 632d625 Initial LodgeMart frontend build (master)
```

### ⚠️ Lesson learned: do NOT run frontend and backend work in the same folder

On the old PC, a frontend session switched the shared folder to `frontend/refurbish` while backend work was
in progress. The backend files "disappeared" from disk; nothing was lost, it was just a branch switch.
We fixed it with a **git worktree**. Do the same on the new PC:

```bash
git clone https://github.com/ChidiAbajue/LodgeMart.git LodgeMart            # frontend folder
cd LodgeMart
git worktree add ../LodgeMart-backend backend/phase-4-vendor-rider          # separate backend folder
```

- `LodgeMart/` → frontend work (`frontend/refurbish` or `master`)
- `LodgeMart-backend/` → backend work (`backend/phase-*`)
- Always check `git branch --show-current` before committing.
- On `frontend/refurbish`, `.gitignore` does **not** ignore `server/.env`. Never keep a `server/.env` in the
  frontend folder. Keep it only in the backend worktree.

---

## 3. New PC setup (step by step)

Install: **Git**, **Node.js 20+** (LTS), **Docker Desktop**, **Claude Code**.

```bash
# 1. Get the code (see worktree layout above)
git clone https://github.com/ChidiAbajue/LodgeMart.git LodgeMart
cd LodgeMart
git worktree add ../LodgeMart-backend backend/phase-4-vendor-rider
cd ../LodgeMart-backend/server

# 2. Secrets file (NOT in git: create it fresh)
cp .env.example .env
#   then set JWT_SECRET to a fresh random value:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
#   paste the output after JWT_SECRET= in server/.env
#   (Old PC's secret is not needed: it only signed dev login tokens.)

# 3. Install + databases
npm install
npm run db:up          # starts Postgres (port 5433) + Redis (6379) in Docker; also creates lodgemart_test DB
npm run db:migrate     # applies migrations to the dev DB
npm run db:seed        # loads prototype sample data

# 4. Check it works
npm run dev            # → http://localhost:4000/api/health should say {"status":"ok"}
npm test               # expect 111 passing (4 files)
```

**Windows notes**
- Run `npm test` from **PowerShell** or a `C:\...` path. From Git Bash (`/c/...` path) vitest fails with
  "failed to find the runner" (drive-letter case bug).
- If port 5432 is free on the new PC it doesn't matter: Docker Postgres uses **5433** on purpose.
- Tests print a pg `DeprecationWarning: client.query() when the client is already executing...`. It comes from
  inside Prisma's adapter and is harmless.

**Sandbox logins** (seeded, password `password123`):
`chinedu.unizik@gmail.com` (student, ₦50,000 wallet), `ogaemeka@lodgemart.ng` and `mamangozi@lodgemart.ng` (vendors),
`tunde.dispatch@lodgemart.ng` (rider), `ops@lodgemart.ng` (admin). Seeded order **#4082**, PIN `4829`.

---

## 4. How we work (rules, also in CLAUDE.md)

1. **Phase-gated:** build → automated tests → manual run → security checklist → one commit per phase → push.
2. **Server decides money:** prices, totals, PINs, payouts, earnings, status changes are all computed server-side.
   Clients never send prices (strict zod schemas reject unknown fields).
3. **Money = integer kobo** (₦1 = 100 kobo).
4. **Secrets only in `server/.env`** (gitignored). `.env.example` lists variables with blank values; `.env.test` has
   local test-only values.
5. **Branch per phase**, cut from the previous phase branch.
6. 18-point security checklist in `CLAUDE.md`: run `npm audit`, `npx depcheck` (`pg` is a known false positive),
   secret-scan the staged diff, and check that `git ls-files` shows no env/dump files.

### Backend folder layout (`server/src/`)
```
config/       env.js (zod-validated env), prisma.js, redis.js, business.js (fees, commission, min rating)
controllers/  authController, healthController, catalogController, orderController, vendorController, riderController
middleware/   authMiddleware (authenticate + PUBLIC_ROUTES allow-list, requireRole, assertOwnerOrAdmin),
              rateLimitMiddleware (Redis), validateMiddleware (zod), errorMiddleware
routes/       authRoutes, healthRoutes, catalogRoutes, orderRoutes, vendorRoutes, riderRoutes
services/     authService, tokenService, catalogService, routingService (pure), orderService, vendorService, riderService
utils/        authSchema, orderSchema, staffSchema (zod), errors, logger, password, batchDate
tests/        phase1..phase4.test.js (vitest + supertest, against the lodgemart_test DB)
```

---

## 5. Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Express, Prisma schema, Postgres+Redis, env validation, helmet, CORS, health, seed | ✅ verified, pushed |
| 2 | Auth: register/login/logout/me, JWT + Redis revocation, bcrypt 12, roles, rate limits | ✅ verified, pushed |
| 3 | Catalog, wallet orders (routing, no overselling), my orders, cancel, delegate | ✅ verified, pushed |
| 4 | Vendor packing + inventory; rider manifest, stall pickup, hub arrival, PIN handover, earnings | ✅ verified 2026-11-28, pushed |
| 5 | Paystack (test mode): initialize, webhook, vendor transfers; photo upload | ⬜ next |
| 6 | Ratings + admin summary | ⬜ |
| 7 | API docs for Chidi, frontend wiring, deploy API (Render/Railway) | ⬜ |

### Phase 4: what was done
- **Endpoints:** `GET /api/vendor/dashboard`, `GET /api/vendor/items`, `PATCH /api/vendor/items/:itemId/packed`,
  `PUT /api/vendor/inventory/:productId`; `GET /api/rider/manifest?batchDate=&batchSlotId=`,
  `POST /api/rider/stall-pickups`, `POST /api/rider/hub-arrivals`, `POST /api/rider/handover`, `GET /api/rider/earnings`.
- **Prototype bug fixed:** a stall pickup collects and pays only that vendor's items for **one batch**
  (one pickup per vendor+slot+date), and only after the slot's cutoff. Payout = wholesale snapshot at order time,
  saved as `PENDING` (Phase 5 does the real transfer → `PAID`).
- **PIN handover:** only `READY_AT_HUB`, single use, ₦150 commission unique per order, locks after 5 attempts
  (atomic counter, so parallel guessing can't exceed it), constant-time compare.
- **Cancel vs pickup race:** cancel is refused once any stall has been collected; tested with concurrent requests.
- **Results:** 111/111 tests (3 consecutive full runs). Manual run on order #4082: pack → manifest → pickups
  (₦7,150 + ₦5,500 pending) → cancel refused → hub arrival → wrong PIN (4 left) → PIN 4829 collected → ₦150 earning.

### Phase 4: checklist completed 2026-11-28 (audit 0, depcheck clean, no env files tracked, 111/111 tests).

### Phase 5 plan (Paystack test mode + photo upload)
Needs from the user: **Paystack TEST secret + public keys** (dashboard → Settings → API Keys, `sk_test_…`/`pk_test_…`)
and a **Cloudinary** account URL for stall photos. Put them only in `server/.env`.
- `POST /api/orders` with `paymentMethod: "PAYSTACK"` → create order `PENDING_PAYMENT` (stock reserved),
  call Paystack initialize, return `authorization_url`.
- `POST /api/payments/paystack/webhook` (public): verify `x-paystack-signature` (HMAC-SHA512 of the raw body),
  idempotent by reference; on `charge.success` check amount = order total → `ORDER_PLACED`, `paidAt`.
  Expire unpaid orders and release stock.
- Vendor payouts: transfer recipient per vendor, transfer per `StallPickup` → `PAID`/`FAILED`, increment
  `payoutBalanceKobo` on success; idempotent via `transferRef`.
- Photo upload endpoint (Cloudinary, size/type limits); stall pickup then only accepts our Cloudinary URLs.
- Tests mock Paystack HTTP; never call live keys.

---

## 6. Known gotchas

- `server/prisma.config.js` holds the DB URL (Prisma 7), and `PrismaClient` needs the `PrismaPg` adapter.
- `overrides.effect = 3.22.5` in `server/package.json` patches a Prisma CLI advisory. Remove it once Prisma ships a fix.
- Tests never run `prisma migrate reset`; `tests/globalSetup.js` refuses unless the DB is `lodgemart_test`.
- Test files must clean up after themselves (they restore stock and reset the order-number sequence).
- Auth: frontend sends `Authorization: Bearer <token>`. Every `/api` route needs a token unless it's in
  `PUBLIC_ROUTES` (`server/src/middleware/authMiddleware.js`).
- Batch date: an order joins today's batch if placed before the slot cutoff (Lagos time), else tomorrow's.
