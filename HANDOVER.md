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
| `backend/phase-4-vendor-rider` | `1f61a33` | yes | Phases 1–4 |
| `backend/phase-5-payments` | `95c9996` | yes | Phases 1–5 |
| `backend/phase-6-ratings-admin` | `c75d35f` | yes | Phases 1–6 |
| **`backend/phase-7-deploy-docs`** | (latest) | yes | **Phases 1–7 — the complete backend. ← USE THIS** |
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
git worktree add ../LodgeMart-backend backend/phase-7-deploy-docs          # separate backend folder
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
git worktree add ../LodgeMart-backend backend/phase-7-deploy-docs
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
npm test               # expect 181 passing (7 files)
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
| 5 | Paystack (test mode): initialize, webhook, vendor transfers; photo upload | 🟨 built + 137 tests (Paystack mocked); **needs a manual run with real TEST keys** |
| 6 | Ratings + admin summary + staff accounts | ✅ verified 2026-11-28, pushed |
| 7 | API docs, deployment config (Supabase/Upstash/Render), production safety | ✅ built + tested locally; **deploy needs the user's accounts** → `docs/DEPLOYMENT.md` |

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

### Phase 5: what was done (branch `backend/phase-5-payments`)
- **Card checkout:** `POST /api/orders` with `paymentMethod: "PAYSTACK"` → order `PENDING_PAYMENT` (stock held,
  PIN hidden) + `payment.authorizationUrl` (send the student there). If Paystack is unreachable → 502 and stock released.
- **Webhook** `POST /api/payments/paystack/webhook` (public, HMAC-SHA512 signature over the raw body):
  `charge.success` → `ORDER_PLACED` only if amount + currency match; duplicates harmless; payment after
  cancel/expiry → full refund to wallet. `transfer.success/failed/reversed` → payout status.
- **`POST /api/orders/:id/verify-payment`** (owner): asks Paystack directly (for when the webhook is slow).
- **Expiry:** unpaid card orders release stock after `PENDING_PAYMENT_TTL_MINUTES` (30). Timer runs in `server.js`.
- **Vendor payouts:** `POST /api/admin/payouts/run`, `GET /api/admin/payouts?status=` (ADMIN). Flow:
  PENDING/FAILED → PROCESSING → PAID (vendor `payoutBalanceKobo` credited once). New reference per attempt.
- **Photos:** `GET /api/rider/photo-upload-signature` → the phone uploads straight to Cloudinary, then sends the
  returned `secure_url` as `photoUrl`. Pickups reject photos outside `res.cloudinary.com/<our cloud>/…/lodgemart/stall-pickups/`.
- **Safety:** a live key (`sk_live_`) is refused unless `NODE_ENV=production`. Without keys, card/uploads/payouts answer 503.

### Phase 5: still to do before calling it ✅ (needs the user)
1. Create a **Paystack** account → Settings → API Keys & Webhooks → copy the **Test Secret Key** (`sk_test_…`) and
   Test Public Key into `server/.env`. Set the webhook URL (needs a public URL: use a tunnel such as
   `cloudflared tunnel --url http://localhost:4000` or ngrok) to `<public-url>/api/payments/paystack/webhook`.
   For payouts in test mode, **disable transfer OTP** (Settings → Preferences).
2. Create a **Cloudinary** account → copy the "API environment variable" (`cloudinary://…`) into `CLOUDINARY_URL`.
3. Manual run: card order → pay on the Paystack test page (test card 4084 0840 8408 4081, any future date, CVV 408,
   PIN 0000, OTP 123456) → webhook marks it paid; run payouts; upload a photo via the signature endpoint.
4. Mark Phase 5 ✅ in CLAUDE.md, commit, push. Then Phase 6 (ratings + admin summary).

### What's left (all needs the user's accounts, nothing more to code)
1. **Phase 5 live test:** Paystack TEST keys + Cloudinary → card payment, payout, photo upload (steps above).
2. **Go live:** follow `docs/DEPLOYMENT.md` (Supabase, Upstash, Render, then Paystack webhook URL, then Vercel `VITE_API_URL`).
3. **Frontend wiring (Chidi):** `docs/API.md` maps every prototype function to an endpoint, with a ready `api.js`.
4. **PRs:** none opened yet (user's choice). `backend/phase-7-deploy-docs` contains everything. One PR from it into
   `master` is enough. `master` on GitHub has moved since we branched (`b20812f`), so expect to merge `master` in first.
5. **Deferred ideas (user said later):** vendor "remove item", and vendors requesting new products for admin approval.

## 6. Known gotchas

- `server/prisma.config.js` holds the DB URL (Prisma 7), and `PrismaClient` needs the `PrismaPg` adapter.
- `overrides.effect = 3.22.5` in `server/package.json` patches a Prisma CLI advisory. Remove it once Prisma ships a fix.
- Tests never run `prisma migrate reset`; `tests/globalSetup.js` refuses unless the DB is `lodgemart_test`.
- Test files must clean up after themselves (they restore stock and reset the order-number sequence).
- Auth: frontend sends `Authorization: Bearer <token>`. Every `/api` route needs a token unless it's in
  `PUBLIC_ROUTES` (`server/src/middleware/authMiddleware.js`).
- Batch date: an order joins today's batch if placed before the slot cutoff (Lagos time), else tomorrow's.
