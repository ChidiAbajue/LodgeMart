# LodgeMart frontend refurbish: progress log

This is a visual refurbish of `src/`, based on the TikTok grocery reference and the LodgeMart logo.
Work happens on the `frontend/refurbish` branch (cut from `master`). It never touches `server/` or the `backend/*` branches.

## Rules
- **Design only.** No business logic, route, role guard or displayed number changes. `LodgeMartContext.jsx` stays the source of truth.
- **Structure:**
  - Pages stay in `src/pages/` and modals in `src/components/`.
  - Shared pieces go in `src/components/ui/` (Button, ProductCard, SectionHeader, RollingDigits) and `src/components/brand/` (Logo).
  - Motion tokens live in `src/lib/motion.js`.
- **Tokens:** Tailwind v4 `@theme` in `src/index.css`.
  - Colours: `brand-*` green `#144E2F` and `accent-*` orange `#F28724`, both sampled from the logo; `ink`, `muted`, `line`, `canvas`.
  - Font: Figtree.
- **Motion:** Motion (`motion/react`), wrapped in `<MotionConfig reducedMotion="user">`.
  - Animations are short and snappy: 0.16–0.4s with ease `[0.2,0.8,0.2,1]`.
  - Each page gets one or two signature moments. Nothing loops, tilts or fades in on every scroll.
- **Product photos:** `public/products/<sku>.webp`, mapped by id in `src/data/productImages.js`. If a photo fails to load, the product's emoji shows instead.
  - They are Wikimedia Commons stand-ins until vendors supply their own. Credits are in `public/products/CREDITS.md`.

## Phases
| # | Area | Status |
|---|---|---|
| R0 | Foundation: tokens, Figtree, SVG logo + favicon, Motion, UI primitives, product photos, dead-file cleanup | ✅ 2026-11-27 |
| R1 | Navbar, footer, landing (hero, how it works, value cards, product grid, savings calculator) | ✅ 2026-11-27, waiting on owner's hero review |
| R2 | Storefront, cart, checkout | ⬜ |
| R3 | Student orders, delegate, rating | ⬜ |
| R4 | Login | ⬜ |
| R5 | Vendor portal | ⬜ |
| R6 | Rider portal, camera | ⬜ |
| R7 | Admin dashboard | ⬜ |

## Log
- **2026-11-27, R0 + R1.**
  - `npm run build` is clean, and lint shows no new warnings.
  - Checked in a browser at 1440 and 390 px. Add to cart turns into the stepper and the navbar badge updates (qty 2, 0 console errors). The page renders fully with reduced motion.
  - `npm audit`: 0 vulnerabilities (added `motion@12.43`).
  - Landing numbers are unchanged: 28% slider rate, 25%–35% markup, ₦350, the 42:15 countdown, and the #4082 seed order.
  - Open question for the owner: the catalog prices work out to about 23% cheaper than kiosks (kiosks about 30% dearer), but the calculator uses 28%.
