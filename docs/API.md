# LodgeMart API — guide for the frontend

This guide is for wiring the React app (`src/`) to the backend in `server/`.
Every endpoint here is covered by automated tests (`server/tests/phase1…7.test.js`). If the docs and the
code ever disagree, the tests show the truth.

- **Local:** `http://localhost:4000/api` (run `npm run dev` in `server/`, see `HANDOVER.md`)
- **Live:** `https://<render-service>.onrender.com/api` (after deployment, see `docs/DEPLOYMENT.md`)

Put the base URL in a Vite env var, `VITE_API_URL`, and never hard-code it.

---

## 1. Basics

### Logging in and the token
`POST /auth/login` (or `/auth/register`) returns `{ token, tokenType: "Bearer", user }`.
Send the token on every other request:
```
Authorization: Bearer <token>
```
- **Expiry:** the token lasts 1 day. On a **401**, clear it and send the user to the login page.
- **Storage:** keep it in memory plus `localStorage`, as the prototype did with the user. Never put it in a URL.
- **Logout:** `POST /auth/logout` cancels the token on the server. Delete it on the client too.
- **Public routes:** only `GET /health`, `POST /auth/register`, `POST /auth/login`, `GET /catalog` and the
  Paystack webhook work without a token. Everything else returns 401.

### Money
**All amounts are integer kobo** (₦1 = 100 kobo), in fields ending in `Kobo`. Display them with:
```js
const naira = (kobo) => `₦${(kobo / 100).toLocaleString('en-NG')}`;   // 1445000 -> "₦14,450"
```
**Never send prices or totals to the server.** It calculates them, and requests that include them are rejected.

### Errors
Every error has the same shape:
```json
{ "error": { "code": "OUT_OF_STOCK", "message": "Not enough stock for Local Parboiled Rice", "details": { "productId": "sku-rice" } } }
```
Show `message` to the user and use `code` for logic. Common codes:

| HTTP | code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad input. `details` lists the fields (`path`, `message`) |
| 401 | `UNAUTHENTICATED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `INVALID_CREDENTIALS` | Not logged in, or bad login |
| 403 | `FORBIDDEN`, `ACCOUNT_DISABLED` | Wrong role / disabled account |
| 404 | `NOT_FOUND` | Missing, **or not yours** (we never say "forbidden" for another user's order) |
| 409 | various | The action doesn't fit the current state (e.g. `CANNOT_CANCEL`, `ALREADY_RATED`) |
| 429 | `RATE_LIMITED`, `PIN_LOCKED` | Too many attempts. A `Retry-After` header gives the seconds to wait |
| 503 | `SERVICE_UNAVAILABLE`, `PAYMENTS_NOT_CONFIGURED`, `UPLOADS_NOT_CONFIGURED` | Try later / feature off |

**Unknown fields are rejected** with 400. Send exactly the fields listed below.

### Order status (prototype label → API value)

| Prototype | API `status` |
|---|---|
| *(card payment not finished)* | `PENDING_PAYMENT` |
| Order Placed | `ORDER_PLACED` |
| Packed at Market | `PACKED_AT_MARKET` |
| Rider In Transit | `RIDER_IN_TRANSIT` |
| Ready at Hub | `READY_AT_HUB` |
| Collected | `COLLECTED` |
| *(cancelled)* | `CANCELLED` |

IDs: orders use `id` (a uuid) in URLs. Show `orderLabel` ("#4083") to people.
Dates such as `batchDate` are `"YYYY-MM-DD"` (Lagos calendar day).

---

## 2. Prototype function → API call

| `LodgeMartContext` function | API |
|---|---|
| `login(email, password)` | `POST /auth/login` |
| `logout()` | `POST /auth/logout` |
| `currentUser` on page load | `GET /auth/me` |
| products, zones, hubs, batch slots, `DELIVERY_FEE` | `GET /catalog` |
| `createOrder({ paymentMethod, batchSlot })` | `POST /orders` |
| student's `orders` list | `GET /orders` |
| `cancelOrder(orderId)` | `POST /orders/:id/cancel` |
| `delegateOrderPin(orderId, name, phone)` | `POST /orders/:id/delegate` |
| `submitOrderRating(orderId, stars, flaggedItemsMap)` | `POST /orders/:id/rating` |
| `walletBalance` | `user.walletBalanceKobo` from `GET /auth/me` |
| vendor: `orderItems` for my stall | `GET /vendor/items` |
| `toggleItemPacked(itemId)` | `PATCH /vendor/items/:itemId/packed` `{ packed }` |
| `updateVendorInventory(vendorId, productId, price, qty)` | `PUT /vendor/inventory/:productId` |
| rider: stalls + hubs for a batch | `GET /rider/manifest?batchDate=&batchSlotId=` |
| `confirmStallPickup(vendorId, batchSlot, photo)` | upload photo → `POST /rider/stall-pickups` (see §6) |
| `markHubArrived(hubName)` | `POST /rider/hub-arrivals` |
| `verifyHandoverPin(orderId, pin)` | `POST /rider/handover` |
| `riderEarnings` | `GET /rider/earnings` |
| admin dashboard figures | `GET /admin/summary` |
| `resetSampleData()` | *(none: dev only, `npm run db:seed` on the server)* |

The **cart stays in the frontend**, as in the prototype. Send it only at checkout.

---

## 3. Auth

### `POST /auth/register` (public): student sign-up
```json
{ "name": "Ada Obi", "email": "ada@gmail.com", "phone": "08031234567", "password": "at-least-8-chars" }
```
`phone` is optional (Nigerian format: `080…` or `+23480…`). Returns **201** `{ token, tokenType, user }`.
Only creates **students**. Vendors, riders and admins are created by an admin.
Errors: `EMAIL_TAKEN` (409), `VALIDATION_ERROR`, `RATE_LIMITED` (10 sign-ups/hour per network).

### `POST /auth/login` (public)
`{ "email", "password" }` → `{ token, tokenType, user }`.
Wrong password and unknown email give the same `INVALID_CREDENTIALS`.
After 5 attempts in 15 min for one email: `RATE_LIMITED`.

### `GET /auth/me`
→ `{ user }`, where `user` is:
```json
{ "id": "…", "email": "…", "name": "…", "phone": null, "role": "STUDENT|VENDOR|RIDER|ADMIN",
  "walletBalanceKobo": 5000000, "defaultZoneId": "ifite", "defaultHubId": "dynamo-junction",
  "vendorId": null, "createdAt": "…" }
```
Use `role` to pick the home page (`/shop`, `/vendor`, `/rider`, `/admin`), as the prototype's `homeRoute` did.

### `POST /auth/logout` → 204

---

## 4. Shop and orders (student)

### `GET /catalog` (public)
```json
{
  "products": [{ "id": "sku-rice", "name": "Local Parboiled Rice", "unit": "1 Paint Bucket (4kg)", "category": "Grains & Staples",
                 "emoji": "🍚", "studentPriceKobo": 520000, "kioskComparePriceKobo": 680000, "inStock": true }],
  "zones": [{ "id": "ifite", "name": "UNIZIK – Ifite", "hubs": [{ "id": "dynamo-junction", "name": "Dynamo Junction" }] }],
  "batchSlots": [{ "id": "midday", "label": "Midday Break", "startTime": "13:00", "endTime": "14:00",
                   "cutoffTime": "12:15", "badge": "Most Popular", "nextBatchDate": "2026-11-28" }],
  "fees": { "deliveryFeeKobo": 35000, "cancellationFeeKobo": 20000 }
}
```
`nextBatchDate` is the day an order placed **now** would be delivered: today if before the cutoff, otherwise tomorrow.
Show it at checkout ("Arrives Midday Break, Sat 28 Nov").

### `POST /orders`: checkout
```json
{ "items": [{ "productId": "sku-rice", "qty": 1 }, { "productId": "sku-beans", "qty": 2 }],
  "zoneId": "ifite", "hubId": "dynamo-junction", "batchSlotId": "midday", "paymentMethod": "WALLET" }
```
- 1–20 different products, qty 1–50 each, each product once. The hub must belong to the zone.
- **WALLET** → **201** `{ order }`, already paid (`ORDER_PLACED`), with `pickupPin`.
- **PAYSTACK** → **201** `{ order, payment: { provider, reference, authorizationUrl } }`, status `PENDING_PAYMENT`,
  no PIN yet. See §5.

`order` looks like:
```json
{ "id": "uuid", "orderNumber": 4083, "orderLabel": "#4083", "status": "ORDER_PLACED",
  "zone": { "id", "name" }, "hub": { "id", "name" }, "batchSlot": { "id", "label", "startTime", "endTime" },
  "batchDate": "2026-11-28", "pickupPin": "4829", "delegateName": null, "delegatePhone": null,
  "requiresBagMerge": true, "subtotalKobo": 1130000, "deliveryFeeKobo": 35000, "totalKobo": 1165000,
  "paymentMethod": "WALLET", "paymentRef": "…", "paidAt": "…", "deliveredTo": null, "collectedAt": null,
  "ratedAt": null, "cancelledAt": null, "refundKobo": null, "createdAt": "…",
  "items": [{ "id": "uuid", "productId": "sku-rice", "qty": 1, "studentPriceKobo": 520000,
              "vendorPacked": false, "riderPickedUp": false, "itemRating": null, "issueTag": null,
              "product": { "name", "unit", "emoji" }, "vendor": { "id", "name", "stallNumber" } }] }
```
Errors: `OUT_OF_STOCK` (409, `details.productId`), `INSUFFICIENT_FUNDS` (402), `INVALID_HUB`, `INVALID_BATCH_SLOT`,
`PRODUCT_UNAVAILABLE` (400), `RATE_LIMITED` (20 order actions per 10 min).

### `GET /orders` → `{ orders: [order…] }`
The student's own orders, newest first (max 50).

### `GET /orders/:id` → `{ order }`
`pickupPin` appears only for the owner, and only once paid. Another user's order returns 404.

### `POST /orders/:id/cancel`
Allowed while `PENDING_PAYMENT`, `ORDER_PLACED` or `PACKED_AT_MARKET`, and before any stall has been collected.
→ `{ orderId, status: "CANCELLED", refundKobo, cancellationFeeKobo }`
- Paid orders: refund = total − ₦200, paid into the **wallet**.
- Unpaid card orders: nothing to refund, no fee.

Errors: `CANNOT_CANCEL`, `ALREADY_CANCELLED` (409).

### `POST /orders/:id/delegate`: roommate pickup
`{ "name": "Obinna Okeke", "phone": "08035556666" }` → `{ orderId, pickupPin, delegateName, delegatePhone }`.
**A new PIN is issued and the old one stops working.** Show the new PIN.

### `POST /orders/:id/rating`: after collection, once
```json
{ "stars": 2, "flaggedItems": [{ "itemId": "<order item uuid>", "issueTag": "Weevils/Dusty" }] }
```
- `issueTag` is one of: `"Short Measure"`, `"Weevils/Dusty"`, `"Damaged Pack"`. These are the modal's `ISSUE_TAGS`.
- 4–5 stars: send no flags; every stall is credited.
- 1–3 stars: **at least one flagged item is required** (`FLAG_REQUIRED`). Only the flagged items' stalls get the low score.
- The prototype's `flaggedItemsMap` `{ itemId: tag }` becomes this array.

Errors: `NOT_COLLECTED`, `ALREADY_RATED` (409), `INVALID_ITEM`, `FLAG_REQUIRED` (400).

---

## 5. Card payments (Paystack)

1. `POST /orders` with `"paymentMethod": "PAYSTACK"`.
2. Redirect the student to `payment.authorizationUrl` (`window.location.href = …`).
3. Paystack sends them back to `PAYSTACK_CALLBACK_URL` (set to `https://lodge-mart.vercel.app/orders`), adding
   `?reference=…&trxref=…`.
4. The server learns about the payment through the webhook, usually within seconds. On the orders page, if an
   order is still `PENDING_PAYMENT`, call **`POST /orders/:id/verify-payment`** → `{ order }`. That asks Paystack
   directly. Poll it every few seconds for up to about 30 s, then show "We're confirming your payment".
5. Once `status` is `ORDER_PLACED`, the PIN is available.

Unpaid orders give back their items after **30 minutes** (they become `CANCELLED`). If a payment arrives after that,
the full amount goes to the student's wallet automatically.
If card payments aren't configured: 503 `PAYMENTS_NOT_CONFIGURED`. Hide the card option, or show the message.

---

## 6. Vendor portal (`role: VENDOR`)

| Call | Body / query | Returns |
|---|---|---|
| `GET /vendor/dashboard` | | `{ vendor: { id, name, market, stallNumber, bankName, bankCode, bankAccountNumber, ratingScore, ratingCount, payoutBalanceKobo, pendingPayoutKobo, isActive, inventory: [{ productId, wholesalePriceKobo, stockQty, product: { name, unit, emoji, studentPriceKobo } }] }, stallPickups: [{ id, batchDate, batchSlotId, capturedAt, payoutKobo, payoutStatus, rider: { name } }] }` |
| `GET /vendor/items` | optional `?batchDate=YYYY-MM-DD&batchSlotId=midday` (default: everything not yet collected) | `{ items: [{ id, qty, wholesaleCostKobo, vendorPacked, riderPickedUp, product: {id,name,unit,emoji}, order: { id, orderLabel, status, batchDate, requiresBagMerge, batchSlot: {id,label}, hub: {id,name} } }] }` |
| `PATCH /vendor/items/:itemId/packed` | `{ "packed": true }` | `{ itemId, vendorPacked, orderStatus }` (the order becomes `PACKED_AT_MARKET` when all its items are packed) |
| `PUT /vendor/inventory/:productId` | `{ "wholesalePriceKobo": 470000, "stockQty": 45 }` | `{ inventory }`. Set `stockQty: 0` to stop receiving orders for that product |
| `GET /vendor/feedback` | | `{ feedback: [{ itemRating, issueTag, qty, product, orderLabel, ratedAt, batchDate }] }` |

Vendors never see students' names, phones, emails or PINs. `payoutStatus` is one of `PENDING`, `PROCESSING`, `PAID`, `FAILED`.

---

## 7. Rider portal (`role: RIDER`)

### `GET /rider/manifest?batchDate=2026-11-28&batchSlotId=midday`
```json
{ "batch": { "batchDate", "batchSlotId", "label", "cutoffTime", "pickupOpen": true },
  "stalls": [{ "vendor": { "id", "name", "stallNumber", "market" },
               "items": [{ "orderLabel", "product": { "name", "unit" }, "qty", "vendorPacked", "riderPickedUp" }],
               "pickup": null }],
  "hubs": [{ "hub": { "id", "name" }, "arrivedAt": null,
             "orders": [{ "id", "orderLabel", "status", "recipientName": "Obinna Okeke (Delegate)", "requiresBagMerge", "itemCount" }] }] }
```
`pickupOpen` is false before the slot's cutoff. Pickups are refused until then.

### Stall pickup with a photo (replaces the prototype's `photoDataUrl`)
1. `GET /rider/photo-upload-signature` → `{ uploadUrl, fields: { folder, timestamp, allowed_formats, api_key, signature } }`
2. Upload the photo **straight to Cloudinary**:
   ```js
   const fd = new FormData();
   Object.entries(sig.fields).forEach(([k, v]) => fd.append(k, v));
   fd.append('file', blobOrDataUrl);            // the CameraCaptureModal output works (data URL is fine)
   const up = await fetch(sig.uploadUrl, { method: 'POST', body: fd }).then((r) => r.json());
   // up.secure_url is the photo URL
   ```
3. `POST /rider/stall-pickups` `{ "vendorId": "v-emeka", "batchDate": "2026-11-28", "batchSlotId": "midday", "photoUrl": up.secure_url }`
   → **201** `{ stallPickupId, itemsCollected, payoutKobo, payoutStatus: "PENDING", ordersInTransit }`

Errors: `BEFORE_CUTOFF`, `ALREADY_PICKED_UP`, `NOTHING_TO_COLLECT` (409), `INVALID_PHOTO` (400; the photo must come
from step 2).

### `POST /rider/hub-arrivals`
`{ "hubId", "batchDate", "batchSlotId" }` → `{ hubId, arrivedAt, ordersReady }`. In-transit orders for that hub become `READY_AT_HUB`. Safe to repeat.

### `POST /rider/handover`
`{ "orderId": "<uuid from manifest>", "pin": "4829" }` → `{ orderId, orderLabel, status: "COLLECTED", deliveredTo, earnedKobo: 15000 }`
- Wrong PIN: 400 `INVALID_PIN` with `details.attemptsLeft`.
- After 5 attempts: 429 `PIN_LOCKED` for 15 minutes.
- Also: `NOT_READY`, `ALREADY_COLLECTED` (409).

### `GET /rider/earnings` → `{ totalKobo, deliveries, recent: [{ amountKobo, createdAt, orderLabel, batchDate }] }`

---

## 8. Admin console (`role: ADMIN`)

| Call | Body / query | Returns |
|---|---|---|
| `GET /admin/summary` | optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` (by batch date) | `{ orders: { byStatus, paidAndActive }, money: { salesKobo, deliveryFeesKobo, itemMarginKobo, cancellationFeesKobo, refundsKobo, riderEarningsKobo, grossProfitKobo, studentWalletBalancesKobo }, payouts: { PENDING: { count, amountKobo }, … }, deliveries: { collected }, vendors: [{ id, name, stallNumber, ratingScore, ratingCount, isActive, payoutBalanceKobo, flaggedItems, receivesOrders }] }` |
| `GET /admin/orders` | `?status=&batchDate=&page=1` | `{ page, pageSize: 50, total, orders: [{ …, student: { name, email, phone }, hub, itemCount }] }` (no PINs) |
| `GET /admin/users` | `?role=VENDOR` | `{ users }` |
| `POST /admin/users` | see below | **201** `{ user }` |
| `PATCH /admin/users/:id` | `{ "isActive": false }` | `{ user }`. A disabled user is logged out immediately |
| `GET /admin/vendors` | | `{ vendors: [{ …stall, bank, rating, user: { email } }] }` |
| `PATCH /admin/vendors/:id` | any of `{ name, stallNumber, market, bankName, bankCode, bankAccountNumber, isActive }` | `{ vendor }` |
| `GET /admin/payouts` | `?status=PENDING` | `{ payouts }` |
| `POST /admin/payouts/run` | | `{ attempted, results: [{ stallPickupId, vendorId, amountKobo, status, reason? }] }`: sends vendor payouts via Paystack |

Create staff:
```json
{ "role": "VENDOR", "name": "Iya Bisi", "email": "bisi@lodgemart.ng", "password": "min-10-chars",
  "vendor": { "stallNumber": "Stall D-02", "bankName": "UBA", "bankCode": "033", "bankAccountNumber": "1234567890", "market": "Eke Awka" } }
```
`role` is `VENDOR` (needs `vendor`), `RIDER` or `ADMIN` (no `vendor`). `bankCode` is the Paystack bank code
(GTBank 058, Access 044, Zenith 057, UBA 033, First Bank 011…).

---

## 9. A small client to copy

```js
// src/lib/api.js
const BASE = import.meta.env.VITE_API_URL;           // e.g. http://localhost:4000/api
let token = localStorage.getItem('lm_token');

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('lm_token', t);
  else localStorage.removeItem('lm_token');
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (res.status === 401) setToken(null);              // send the user to /login
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Examples
// const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } }); setToken(token);
// const catalog = await api('/catalog');
// const { order, payment } = await api('/orders', { method: 'POST', body: { items, zoneId, hubId, batchSlotId, paymentMethod } });
// if (payment) window.location.href = payment.authorizationUrl;
```

Sandbox logins on a local server (after `npm run db:seed`), all with password `password123`:
`chinedu.unizik@gmail.com` (student), `ogaemeka@lodgemart.ng` (vendor), `tunde.dispatch@lodgemart.ng` (rider), `ops@lodgemart.ng` (admin).
