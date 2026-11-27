import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Clock,
  ShieldCheck,
  MapPin,
  Store,
  Bike,
  KeyRound,
  TrendingDown,
  Banknote,
} from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import { INITIAL_ORDERS, INITIAL_ORDER_ITEMS } from '../data/seedData';
import { getProductImage } from '../data/productImages';
import Button from '../components/ui/Button';
import ProductCard from '../components/ui/ProductCard';
import SectionHeader from '../components/ui/SectionHeader';
import RollingDigits from '../components/ui/RollingDigits';
import Footer from '../components/Footer';
import { EASE, SPRING_POP } from '../lib/motion';

const SAMPLE_ORDER = INITIAL_ORDERS[0];
const SAMPLE_ITEMS = INITIAL_ORDER_ITEMS.filter((i) => i.orderId === SAMPLE_ORDER.id);
const SAMPLE_STALLS = new Set(SAMPLE_ITEMS.map((i) => i.assignedVendorId)).size;

/* ---------- Hero pieces ---------- */

function MaskLine({ children, delay }) {
  return (
    <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
      <motion.span
        className="block"
        initial={{ y: '105%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.6, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function Underlined({ children, delay }) {
  return (
    <span className="relative inline-block">
      {children}
      <svg
        className="absolute left-0 -bottom-[0.24em] w-full h-[0.24em] overflow-visible"
        viewBox="0 0 300 20"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <motion.path
          d="M3 14 C 70 4, 180 2, 297 9"
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth="7"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay }}
        />
      </svg>
    </span>
  );
}

function PhotoTile({ productId, alt, className, delay }) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl bg-brand-100 ${className}`}
      initial={{ clipPath: 'inset(100% 0% 0% 0% round 16px)' }}
      animate={{ clipPath: 'inset(0% 0% 0% 0% round 16px)' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      <motion.img
        src={getProductImage(productId)}
        alt={alt}
        width="640"
        height="640"
        fetchPriority={delay < 0.3 ? 'high' : 'auto'}
        className="h-full w-full object-cover"
        initial={{ scale: 1.18 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay }}
      />
    </motion.div>
  );
}

function HeroVisual() {
  return (
    <div className="relative h-[340px] sm:h-[440px] lg:h-full lg:min-h-[520px]">
      <div className="grid h-full grid-cols-5 grid-rows-2 gap-3">
        <PhotoTile productId="sku-beans" alt="Honey beans from an Eke Awka stall" className="col-span-3 row-span-2" delay={0.25} />
        <PhotoTile productId="sku-rice" alt="Local parboiled rice" className="col-span-2" delay={0.37} />
        <PhotoTile productId="sku-garri" alt="Ijebu white garri" className="col-span-2" delay={0.49} />
      </div>

      {/* Proof card: the real seeded order this basket belongs to */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...SPRING_POP, delay: 0.85 }}
        className="absolute left-3 bottom-3 sm:left-5 sm:bottom-5 w-[min(300px,calc(100%-24px))] rounded-2xl bg-white p-4 shadow-lift"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-ink">Order {SAMPLE_ORDER.id}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            <MapPin className="h-3 w-3" /> {SAMPLE_ORDER.pickupHub}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">{SAMPLE_ORDER.batchSlot}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted">Pickup PIN</p>
            <p className="font-mono text-lg font-bold tracking-[0.3em] text-ink">
              ••{SAMPLE_ORDER.pickupPin.slice(-2)}
            </p>
          </div>
          <p className="text-lg font-extrabold text-ink tabular-nums">
            ₦{SAMPLE_ORDER.totalAmount.toLocaleString()}
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...SPRING_POP, delay: 0.97 }}
        className="absolute right-3 top-3 sm:right-5 sm:top-5 inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 shadow-lift"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-500 text-ink">
          <Store className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-bold text-ink">
          {SAMPLE_ITEMS.length} items · {SAMPLE_STALLS} Eke Awka stalls
        </span>
      </motion.div>
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
    initial: { opacity: 0, y: 14 },
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6" aria-labelledby="hero-title">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-4 rounded-[28px] bg-mint p-4 sm:p-6 lg:p-5 lg:min-h-[calc(100svh-7rem)]">
          <div className="lg:col-span-6 flex flex-col justify-center px-2 py-4 sm:px-4 lg:px-10 lg:py-10">
            <motion.p
              {...rise(0)}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              UNIZIK Pilot · Ifite, Tempsite &amp; Aroma
            </motion.p>

            <h1
              id="hero-title"
              className="mt-5 text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[4.1rem] font-extrabold tracking-[-0.045em] text-ink"
            >
              <MaskLine delay={0.05}>Eke Awka prices,</MaskLine>
              <MaskLine delay={0.13}>delivered to your</MaskLine>
              <MaskLine delay={0.21}>
                <Underlined delay={0.6}>
                  <span className="text-brand-700">lodge junction.</span>
                </Underlined>
              </MaskLine>
            </h1>

            <motion.p {...rise(0.32)} className="mt-6 max-w-md text-base sm:text-lg leading-relaxed text-muted">
              Skip the market commute and the 25%–35% campus kiosk markup. Join a batch run timed to
              your lecture breaks for a flat ₦350.
            </motion.p>

            <motion.div {...rise(0.4)} className="mt-7 grid grid-cols-2 gap-3 sm:flex">
              <Button to="/shop" size="lg" className="px-4 sm:px-7">
                Shop this batch <ArrowRight className="hidden min-[400px]:block w-4 h-4" />
              </Button>
              <Button to="/login" size="lg" variant="secondary" className="px-4 sm:px-7">
                Portal sign in
              </Button>
            </motion.div>

            <motion.div
              {...rise(0.5)}
              className="mt-6 sm:mt-8 flex items-center justify-between gap-3 rounded-2xl bg-white p-3.5 sm:p-4 sm:max-w-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white">
                  <Clock className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-muted">Next cutoff</p>
                  <p className="text-sm font-bold text-ink">Midday Break</p>
                  <p className="hidden sm:block text-xs text-muted">Dynamo · School Gate · Aroma</p>
                </div>
              </div>
              <RollingDigits value={`00:${mins}:${secs}`} className="text-xl sm:text-2xl font-extrabold text-brand-700" />
            </motion.div>
          </div>

          <div className="lg:col-span-6">
            <HeroVisual />
          </div>
        </div>
      </section>

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
