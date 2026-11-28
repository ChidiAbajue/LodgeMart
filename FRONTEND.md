# LodgeMart frontend refurbish: progress log

This is a visual refurbish of `src/`. Work happens on the `frontend/refurbish` branch (cut from `master`). It never touches `server/` or the `backend/*` branches.

## Rules
- **Design only.** No business logic, route, role guard or displayed number changes. `LodgeMartContext.jsx` stays the source of truth.
- **Direction (owner's references):**
  - The Astra templates [organic-shop-02](https://websitedemos.net/organic-shop-02/) and [pizzeria-04](https://websitedemos.net/pizzeria-04/) supply the patterns: photo hero with condensed caps headline, curved edge, circle features, dark photo bands, menu-board section headings, organic-shop product tiles, slash deal cards and a black footer.
  - Earlier directions the owner rejected: the soft mint "simple" look, hard-edge neo-brutalist, and glass/glow cinematic.
- **Structure:**
  - Pages stay in `src/pages/` and modals in `src/components/`.
  - Shared UI lives in `src/components/ui/`:
    - `Button`: sweep-fill hover
    - `ProductCard`
    - `SectionHeader`
    - `PageHeader`: photo header for inner pages
    - `PortalSection`
    - `Modal`: shell + `TextField` + `ActionButton`
    - `Reveal`: scroll reveal and stagger
    - `RollingDigits`
  - The logo is in `src/components/brand/`. Motion tokens are in `src/lib/motion.js`.
- **Tokens:** Tailwind v4 `@theme` in `src/index.css`.
  - Colours: `brand-*` green `#144E2F` and `accent-*` orange `#F28724` (both from the logo), plus `ink`, `muted`, `canvas` and `tile`.
  - Fonts: **Oswald** for display (uppercase) and **Source Sans 3** for body. Both are self-hosted via Fontsource, with no Google Fonts request.
- **Motion:**
  - Motion (`motion/react`) inside `<MotionConfig reducedMotion="user">`, plus Lenis smooth scroll (off for reduced motion).
  - Sharp easing `[0.7,0,0.2,1]` for masks, wipes and sweeps; `[0.16,1,0.3,1]` for settles.
  - Every reveal plays once. Nothing loops except the live countdown.
- **Navbar:** transparent over photo headers (`PHOTO_HEADER_ROUTES` in `Navbar.jsx`), solid white after scrolling.
- **Photos:** Wikimedia Commons stand-ins in `public/products/` (mapped in `src/data/productImages.js`, emoji fallback) and `public/images/`. Credits are in `public/products/CREDITS.md`.

## Steps
| Area | Status |
|---|---|
| Foundation: tokens, fonts, logo, Motion, primitives | ✅ |
| Landing page | ✅ 2026-11-27 (v3, from the owner's references) |
| Shop, basket drawer, checkout | ✅ 2026-11-27 |
| Login, my orders, delegate + rating modals | ✅ 2026-11-27 |
| Vendor portal, rider dispatch + camera, admin dashboard | ✅ 2026-11-27 |

## Log
- **2026-11-27: full pass in the reference style.** Checks run on each step:
  - `npm run build` is clean, and lint shows no new warnings. The only remaining warnings predate the redesign: CameraCaptureModal, and `Date.now` in RiderPortal.
  - Viewport screenshots at 1440 and 390 px.
  - Reduced-motion render.
- **End-to-end test (playwright):**
  - Shop: add to basket, stepper, badge, drawer, checkout, order placed.
  - Student: sign in, orders, PIN tiles, delegate modal.
  - Vendor: pack both items (2/2).
  - Rider: camera test frame, confirm both stall pickups, arrive at hub, verify PIN 4829. Result: "Delivered to Chinedu Okafor (+₦150)".
  - Admin: KPIs, split inspector, leaderboard.
  - 0 console errors.
- **Numbers unchanged:** 28% slider rate, 25%–35%, ₦350, the 42:15 countdown, the #4082 seed and all prices.
  - Open question for the owner: the catalog prices work out to about 23% cheaper than kiosks, but the calculator uses 28%.
- **Deploy:** `vercel.json` adds the SPA rewrite so deep links like `/shop` work.
