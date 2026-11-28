# Deploying the LodgeMart API

**Layout:** Supabase (Postgres) + Upstash (Redis) + Render (the Express API). The frontend stays on Vercel.
Every config file this needs is in the repo (`render.yaml`, migrations, scripts). What's left is creating the accounts
and pasting values. **Never paste secrets into git, chat, or the frontend.**

> Status (2026-11-28): everything below is built and tested locally (181 tests), including the Supabase
> lock-down migration and production guard rails. It has **not** yet been run against real Supabase, Upstash or Render
> accounts. Do the first deploy carefully with the checklist in step 7.

---

## 0. Before you start
- Use **Paystack TEST keys** until the whole flow is proven. The server refuses a live key unless `NODE_ENV=production`.
- Keep a password manager or private note for the values you collect below.

## 1. Supabase: the database
1. supabase.com → New project. Region: **Frankfurt (eu-central-1)**, the closest to Nigeria and the same as Render.
   Save the **database password**.
2. Project → **Connect** → **Session pooler** → copy the URI. It looks like
   `postgresql://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
   - `DATABASE_URL` = that URI **as is** (no `?sslmode`).
   - `MIGRATE_DATABASE_URL` = the same URI + `?sslmode=require` (used only by `prisma migrate`).
   - Use the *session* pooler (port 5432), not the transaction pooler (6543). Our server keeps long-lived connections.
3. Project Settings → Database → **SSL configuration → Download certificate**. Paste the whole PEM text
   (`-----BEGIN CERTIFICATE----- …`) into `DATABASE_CA_CERT` and set `DATABASE_SSL=verify`.
   If verification fails on the first deploy (`self-signed certificate in certificate chain`), temporarily set
   `DATABASE_SSL=require`. That's still encrypted, just without checking the certificate. Then fix the certificate.
4. **Do NOT use** Supabase Auth, Storage, or the auto-generated REST/GraphQL API from the frontend. All access goes
   through our API. The migration `lock_down_direct_table_access` switches on Row Level Security for every table and
   revokes the `anon`/`authenticated` roles, so the public anon key can read nothing.

## 2. Upstash: Redis
1. upstash.com → Create Database → Redis, region **eu-central-1 (Frankfurt)**, TLS on.
2. Copy the **`rediss://` connection string** (Node / ioredis tab) → `REDIS_URL`.

Redis holds rate limits, logout (token revocation) and the PIN lock. If it's down, login and handover answer 503
on purpose (fail closed).

## 3. Secrets to generate
- `JWT_SECRET`: run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (96 chars).
  Production requires at least 48.

## 4. Render: the API
1. render.com → **New → Blueprint** → connect the GitHub repo → choose the backend branch (or `master` once merged).
   Render reads `render.yaml` at the repo root.
2. Fill in every variable it asks for:
   - `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `DATABASE_CA_CERT`
   - `REDIS_URL`, `JWT_SECRET`
   - `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
   - `CLOUDINARY_URL`
3. **Plan:** `render.yaml` uses **starter** (paid). It needs `preDeployCommand` to run migrations before each
   deploy, and it never sleeps. On the free plan:
   - move migrations into the build: `buildCommand: npm ci --include=dev && npm run build && npx prisma migrate deploy`
   - remove `preDeployCommand`
   - the free plan sleeps after 15 minutes idle (the first request takes ~30 s, and the unpaid-order expiry timer only runs while it's awake)
4. Deploy. When it's live, `https://<service>.onrender.com/api/health` should return `{"status":"ok", …}`.

The server **refuses to start** in production if:
- `CLIENT_URL` isn't https
- the database isn't encrypted
- `JWT_SECRET` is too short
- `DATABASE_SSL=verify` has no certificate

The error message says which variable is wrong, without printing its value.

## 5. Load reference data and the first admin
Run these **from your PC** (in `server/`), pointing at Supabase. Set the variables in the shell for this one
command only, and don't save them in `.env`.

```powershell
# PowerShell
$env:DATABASE_URL = '<DATABASE_URL value>'   # the plain session-pooler URI (no ?sslmode)
$env:DATABASE_SSL = 'require'                 # encrypted connection to Supabase
$env:NODE_ENV = 'production'
npm run db:seed:reference          # zones, hubs, batch slots, products. Never deletes anything
$env:ADMIN_EMAIL = 'you@yourdomain.ng'; $env:ADMIN_NAME = 'Your Name'; $env:ADMIN_PASSWORD = '<12+ chars, unique>'
npm run create-admin
Remove-Item Env:DATABASE_URL, Env:DATABASE_SSL, Env:NODE_ENV, Env:ADMIN_PASSWORD
```
- The sample seed (`npm run db:seed`) **refuses** to run with `NODE_ENV=production`. It wipes data and creates demo
  logins with `password123`.
- After that, log in as the admin. Create vendor and rider accounts with `POST /api/admin/users`, and have
  vendors set their stock (`PUT /api/vendor/inventory/:productId`).

## 6. Wire up Paystack, Cloudinary and Vercel
- **Paystack dashboard** → Settings → API Keys & Webhooks:
  - Webhook URL: `https://<service>.onrender.com/api/payments/paystack/webhook`
  - Callback URL: already set via `PAYSTACK_CALLBACK_URL` (`https://lodge-mart.vercel.app/orders`)
  - For vendor payouts: Settings → Preferences → **disable OTP for transfers**
- **Cloudinary:** nothing else to do. The API signs uploads, and `CLOUDINARY_URL` is enough.
- **Vercel** (frontend project) → Environment Variables: `VITE_API_URL=https://<service>.onrender.com/api` → redeploy.
- If the frontend is also served from another domain (a custom domain, or Vercel preview URLs), add it to `CLIENT_URL`
  (comma-separated). Otherwise the browser gets a CORS 403.

## 7. First-deploy checklist
- [ ] `GET /api/health` → `status: ok`, database `up`, redis `up`
- [ ] Render logs show no `PAYSTACK_SECRET_KEY not set` / `CLOUDINARY_URL not set` warnings
- [ ] **Supabase lock-down works:** this must return `[]` or a permission error, never rows:
  `curl "https://<ref>.supabase.co/rest/v1/User?select=email" -H "apikey: <anon key>"`
  Supabase → Advisors → Security should show no "RLS disabled" errors.
- [ ] Log in as the admin; `GET /api/admin/summary` works
- [ ] Student sign-up → wallet order works (top up a test wallet via the admin or SQL for testing)
- [ ] **Card test:** order with `PAYSTACK` → pay with Paystack's test card
  (`4084 0840 8408 4081`, any future date, CVV `408`, PIN `0000`, OTP `123456`)
  → order becomes `ORDER_PLACED` within seconds (Render logs: `Paystack webhook … result: PAID`)
- [ ] Rider: photo signature → upload → stall pickup; hub arrival; PIN handover
- [ ] Admin: `POST /api/admin/payouts/run` → test transfer `PAID` (or `PROCESSING` then `PAID` via webhook)
- [ ] CORS: the Vercel site can call the API; a random origin gets 403

## 8. Going live with real money (later)
Swap in the **live** Paystack keys (`sk_live_…`) on Render only after the checklist passes with test keys. Also:
- Update the webhook URL in the Paystack *live* settings.
- Keep Supabase backups on (paid plans have point-in-time recovery). The free plan also **pauses after a week of
  no activity**, so use a paid plan for the real shop.
