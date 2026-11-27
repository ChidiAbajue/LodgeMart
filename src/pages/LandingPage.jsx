import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ShieldCheck,
  MapPin,
  Store,
  Bike,
  KeyRound,
  TrendingDown,
  Banknote,
  Check,
} from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import { INITIAL_ORDERS, INITIAL_ORDER_ITEMS, ALL_HUBS, BATCH_SLOTS, DELIVERY_FEE } from '../data/seedData';
import { getProductImage } from '../data/productImages';
import Button from '../components/ui/Button';
import ProductCard from '../components/ui/ProductCard';
import SectionHeader from '../components/ui/SectionHeader';
import RollingDigits from '../components/ui/RollingDigits';
import Ticker from '../components/ui/Ticker';
import Footer from '../components/Footer';
import { EASE, SPRING_POP } from '../lib/motion';

const SAMPLE_ORDER = INITIAL_ORDERS[0];
const SAMPLE_ITEMS = INITIAL_ORDER_ITEMS.filter((i) => i.orderId === SAMPLE_ORDER.id);
const SAMPLE_STALLS = new Set(SAMPLE_ITEMS.map((i) => i.assignedVendorId)).size;

const TICKER_ITEMS = [
  ...ALL_HUBS.map((hub) => `Pickup at ${hub}`),
  ...BATCH_SLOTS.map((s) => `${s.label} · ${s.time}`),
  `₦${DELIVERY_FEE} flat per batch`,
  'Pay with LodgeMart Wallet or Paystack',
];

/* ---------- Hero pieces ---------- */

/** Headline words rise out of a mask, one after another. */
function Words({ text, start = 0 }) {
  return text.split(' ').map((word, i) => (
    <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.06em] -mb-[0.06em] mr-[0.22em] last:mr-0">
      <motion.span
        className="inline-block"
        initial={{ y: '110%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.62, ease: EASE, delay: start + i * 0.045 }}
      >
        {word}
      </motion.span>
    </span>
  ));
}

/** A cut-out product that drops in and settles. */
function Drop({ productId, alt, className, delay, eager }) {
  return (
    <motion.img
      src={getProductImage(productId)}
      alt={alt}
      width="800"
      height="800"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      className={`absolute select-none pointer-events-none ${className}`}
      initial={{ y: -48, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 20, delay }}
    />
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      {/* orange disc the basket sits on */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-[6%] rounded-full bg-accent-500 border-2 border-ink"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.15 }}
      />
      <Drop productId="sku-rice" alt="" className="w-[30%] right-[6%] top-[8%]" delay={0.45} />
      <Drop productId="sku-oil" alt="Vegetable oil" className="w-[56%] left-[22%] top-[2%]" delay={0.35} eager />
      <Drop productId="sku-indomie" alt="Instant noodles" className="w-[40%] left-[2%] top-[40%]" delay={0.55} />
      <Drop productId="sku-beans" alt="Honey beans" className="w-[38%] right-[2%] top-[46%]" delay={0.65} />

      {/* proof card: the seeded order #4082 */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_POP, delay: 0.95 }}
        className="absolute left-0 bottom-[2%] w-[min(300px,88%)] sm:w-[min(300px,70%)] rounded-2xl border-2 border-ink bg-cream p-4 text-ink shadow-[5px_5px_0_0_var(--color-ink)]"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-lg font-extrabold whitespace-nowrap">Order {SAMPLE_ORDER.id}</p>
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-semibold text-white">
            <MapPin className="h-3 w-3" /> {SAMPLE_ORDER.pickupHub}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{SAMPLE_ORDER.batchSlot}</p>
        <div className="mt-3 flex items-end justify-between border-t-2 border-dashed border-ink/20 pt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Pickup PIN</p>
            <p className="font-mono text-xl font-bold tracking-[0.25em]">••{SAMPLE_ORDER.pickupPin.slice(-2)}</p>
          </div>
          <p className="font-display text-xl font-extrabold tabular-nums">₦{SAMPLE_ORDER.totalAmount.toLocaleString()}</p>
        </div>
      </motion.div>

      {/* stall chip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING_POP, delay: 1.1 }}
        className="absolute right-0 top-0 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-cream py-1.5 pl-1.5 pr-3.5 text-ink shadow-[3px_3px_0_0_var(--color-ink)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-white">
          <Check className="h-4 w-4" />
        </span>
        <span className="text-xs font-bold">
          {SAMPLE_ITEMS.length} items · {SAMPLE_STALLS} Eke Awka stalls
        </span>
      </motion.div>
    </div>
  );
}

/** Countdown as a ticket stub: notched sides, dashed tear line. */
function CutoffTicket({ mins, secs }) {
  return (
    <div className="relative mt-8 flex w-full max-w-md items-stretch rounded-2xl border-2 border-ink bg-cream text-ink shadow-[5px_5px_0_0_var(--color-ink)]">
      <span aria-hidden="true" className="absolute -left-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-ink bg-brand-700 [clip-path:inset(0_0_0_50%)]" />
      <span aria-hidden="true" className="absolute -right-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-ink bg-brand-700 [clip-path:inset(0_50%_0_0)]" />
      <div className="flex-1 px-5 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Next cutoff</p>
        <p className="font-display text-lg font-extrabold leading-tight">Midday Break</p>
        <p className="hidden sm:block text-xs text-muted">Dynamo · School Gate · Aroma</p>
      </div>
      <div className="flex items-center border-l-2 border-dashed border-ink/30 px-5">
        <RollingDigits value={`00:${mins}:${secs}`} className="font-display text-2xl sm:text-3xl font-extrabold text-brand-700" />
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

const STEPS = [
  { icon: Store, title: 'Order before cutoff', body: 'Pick from verified Eke Awka stalls at market prices.' },
  { icon: Bike, title: 'One rider per batch', body: 'Your batch is packed at the stalls and collected in one run.' },
  { icon: MapPin, title: 'Drop at your junction', body: 'Dynamo Junction, School Gate or Aroma Junction.' },
  { icon: KeyRound, title: 'Collect with your PIN', body: 'Show your 4-digit PIN. Stuck in a lab? Delegate it.' },
];

export default function LandingPage() {
  const { products, cart, addToCart, updateCartQty } = useLodgeMart();
  const reduce = useReducedMotion();
  const [monthlySpend, setMonthlySpend] = useState(35000);
  const [secondsLeft, setSecondsLeft] = useState(42 * 60 + 15);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 45 * 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const estimatedMonthlySavings = Math.round(monthlySpend * 0.28);

  const qtyOf = (id) => cart.find((c) => c.productId === id)?.qty || 0;
  const rise = (delay) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: EASE, delay },
  });
  const inView = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.3 },
        transition: { duration: 0.55, ease: EASE },
      };

  return (
    <div className="min-h-screen">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-brand-700 text-cream" aria-labelledby="hero-title">
        <div className="max-w-7xl mx-auto grid items-center gap-10 px-4 sm:px-6 pt-10 pb-14 sm:pt-14 lg:grid-cols-12 lg:gap-6 lg:min-h-[calc(100svh-4rem-3.5rem)] lg:py-12">
          <div className="lg:col-span-7">
            <motion.p
              {...rise(0)}
              className="inline-flex items-center gap-2 rounded-full border-2 border-cream/25 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-cream/85"
            >
              <span className="h-2 w-2 rounded-full bg-accent-500" />
              UNIZIK Pilot · Ifite, Tempsite &amp; Aroma
            </motion.p>

            <h1
              id="hero-title"
              className="mt-6 font-display font-extrabold text-[2.6rem] leading-[0.94] min-[400px]:text-[2.85rem] sm:text-[4.2rem] lg:text-[4.6rem] xl:text-[5.4rem] tracking-[-0.045em] [&>span]:sm:whitespace-nowrap"
            >
              <span className="block"><Words text="Eke Awka prices." start={0.05} /></span>
              <span className="block"><Words text="Delivered to your" start={0.2} /></span>
              <span className="block text-accent-500"><Words text="lodge junction." start={0.35} /></span>
            </h1>

            <motion.p {...rise(0.5)} className="mt-6 max-w-lg text-base sm:text-lg leading-relaxed text-cream/80">
              Skip the market commute and the 25%–35% campus kiosk markup. Join a batch run timed to
              your lecture breaks for a flat ₦350.
            </motion.p>

            <motion.div {...rise(0.6)} className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:gap-4">
              <Button to="/shop" size="lg" variant="accent" className="px-4 sm:px-7">
                Shop this batch <ArrowRight className="hidden min-[400px]:block w-4 h-4" />
              </Button>
              <Button to="/login" size="lg" variant="onDark" className="px-4 sm:px-7">
                Portal sign in
              </Button>
            </motion.div>

            <motion.div {...rise(0.7)}>
              <CutoffTicket mins={mins} secs={secs} />
            </motion.div>
          </div>

          <div className="lg:col-span-5">
            <HeroVisual />
          </div>
        </div>
      </section>

      <Ticker items={TICKER_ITEMS} label="Hubs, batch times and fees" />

      {/* ================= HOW IT WORKS ================= */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24" aria-labelledby="how-title">
        <SectionHeader id="how-title" kicker="How a batch works" title="Market to hub in four steps" />
        <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.span
            aria-hidden="true"
            className="hidden lg:block absolute left-[12%] right-[12%] top-[2.65rem] h-0.5 origin-left bg-brand-200"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.9, ease: EASE }}
          />
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-muted tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= VALUE CARDS ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6" aria-label="Why LodgeMart">
        <motion.div {...inView} className="grid gap-4 md:grid-cols-3">
          <div className="flex min-h-64 flex-col justify-between rounded-3xl bg-brand-700 p-6 text-white">
            <MapPin className="h-7 w-7 text-accent-300" />
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight">Junction batch drops</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-100">
                Pick up at Dynamo Junction, School Gate, or Aroma Junction between lectures for a flat ₦350.
              </p>
            </div>
          </div>
          <div className="flex min-h-64 flex-col justify-between rounded-3xl bg-accent-500 p-6 text-ink">
            <ShieldCheck className="h-7 w-7" />
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight">4-digit PIN &amp; roommate delegate</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">
                Stuck in a lab? Rotate your PIN and delegate pickup to your roommate via WhatsApp in one tap.
              </p>
            </div>
          </div>
          <div className="flex min-h-64 flex-col justify-between rounded-3xl bg-cream p-6 text-ink">
            <Banknote className="h-7 w-7 text-brand-700" />
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight">100% instant vendor payouts</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Traders at Eke Awka get paid 100% on rider pickup with zero holdback, so stock stays fresh.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ================= PRODUCTS ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24" aria-labelledby="picks-title">
        <SectionHeader
          id="picks-title"
          kicker="Eke Awka stalls"
          title="In this batch"
          action={{ to: '/shop', label: 'See full market' }}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              qty={qtyOf(p.id)}
              onAdd={(id) => addToCart(id, 1)}
              onChangeQty={updateCartQty}
            />
          ))}
        </div>
      </section>

      {/* ================= SAVINGS ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24" aria-labelledby="savings-title">
        <motion.div {...inView} className="grid gap-8 rounded-[28px] bg-brand-800 p-6 sm:p-10 lg:grid-cols-2 lg:items-center text-white">
          <div>
            <p className="text-sm font-semibold text-accent-300">Savings calculator</p>
            <h2 id="savings-title" className="mt-1.5 text-3xl sm:text-4xl font-extrabold tracking-[-0.03em]">
              What kiosks cost you each month
            </h2>
            <label htmlFor="spend" className="mt-8 flex items-center justify-between text-sm font-semibold text-brand-100">
              <span>Monthly foodstuff spend</span>
              <span className="text-white tabular-nums">₦{monthlySpend.toLocaleString()}</span>
            </label>
            <input
              id="spend"
              type="range"
              min={10000}
              max={100000}
              step={5000}
              value={monthlySpend}
              onChange={(e) => setMonthlySpend(Number(e.target.value))}
              className="mt-3 w-full cursor-pointer accent-accent-500"
            />
          </div>
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-100">
              <TrendingDown className="h-4 w-4 text-accent-300" />
              Estimated monthly savings vs. campus lodge kiosks
            </div>
            <p className="mt-3 text-5xl sm:text-6xl font-extrabold tracking-[-0.04em] text-accent-400">
              <span>₦</span>
              <RollingDigits value={estimatedMonthlySavings.toLocaleString()} />
            </p>
            <Button to="/shop" variant="onDark" className="mt-6">
              Start saving this batch <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
