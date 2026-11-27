import React, { useState, useEffect, useRef } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
} from 'motion/react';
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
import { EASE } from '../lib/motion';

const SAMPLE_ORDER = INITIAL_ORDERS[0];
const SAMPLE_ITEMS = INITIAL_ORDER_ITEMS.filter((i) => i.orderId === SAMPLE_ORDER.id);
const SAMPLE_STALLS = new Set(SAMPLE_ITEMS.map((i) => i.assignedVendorId)).size;

const TICKER_ITEMS = [
  ...ALL_HUBS.map((hub) => `Pickup at ${hub}`),
  ...BATCH_SLOTS.map((s) => `${s.label} · ${s.time}`),
  `₦${DELIVERY_FEE} flat per batch`,
  'Pay with LodgeMart Wallet or Paystack',
];

const SMOOTH = [0.16, 1, 0.3, 1];

/* ---------- Hero pieces ---------- */

/** Words drift up out of a soft blur, one after another. */
function Words({ text, start = 0, wordClass = '' }) {
  return text.split(' ').map((word, i) => (
    <motion.span
      key={i}
      className={`inline-block mr-[0.2em] last:mr-0 ${wordClass}`}
      initial={{ opacity: 0, y: 28, filter: 'blur(14px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1.05, ease: SMOOTH, delay: start + i * 0.07 }}
    >
      {word}
    </motion.span>
  ));
}

/** Gentle idle float + pointer-depth parallax around any child. */
function Floating({ children, className = '', depth = 10, float = 8, period = 6, delay = 0, px, py }) {
  const reduce = useReducedMotion();
  const x = useTransform(px, (v) => v * depth);
  const y = useTransform(py, (v) => v * depth);
  return (
    <motion.div className={`absolute ${className}`} style={reduce ? undefined : { x, y }}>
      <motion.div
        animate={reduce ? undefined : { y: [0, -float, 0] }}
        transition={{ duration: period, ease: 'easeInOut', repeat: Infinity, delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Product({ productId, alt, delay, eager }) {
  return (
    <motion.img
      src={getProductImage(productId)}
      alt={alt}
      width="800"
      height="800"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      className="w-full select-none pointer-events-none drop-shadow-[0_30px_40px_rgb(0_0_0/0.45)]"
      initial={{ opacity: 0, y: 40, scale: 0.92, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 1.2, ease: SMOOTH, delay }}
    />
  );
}

function HeroStage({ px, py }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[600px]">
      {/* warm sun the products sit in front of */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_45%_35%,#fbbf74_0%,#f28724_38%,#b3570c_72%,#5a2c06_100%)] shadow-[0_0_120px_40px_rgb(242_135_36/0.35)]"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [1, 1.035, 1] }}
        transition={
          reduce
            ? { duration: 1.2, ease: SMOOTH }
            : { opacity: { duration: 1.2, ease: SMOOTH }, scale: { duration: 8, ease: 'easeInOut', repeat: Infinity } }
        }
      />
      {/* floor shadow */}
      <div aria-hidden="true" className="absolute left-[14%] right-[14%] bottom-[9%] h-[8%] rounded-[50%] bg-black/50 blur-2xl" />

      <Floating px={px} py={py} depth={-14} float={7} period={7} className="w-[30%] right-[6%] top-[8%]">
        <Product productId="sku-rice" alt="" delay={0.55} />
      </Floating>
      <Floating px={px} py={py} depth={22} float={10} period={6} className="w-[52%] left-[24%] top-[3%]">
        <Product productId="sku-oil" alt="Vegetable oil" delay={0.4} eager />
      </Floating>
      <Floating px={px} py={py} depth={12} float={6} period={6.5} delay={0.8} className="w-[40%] left-[2%] top-[42%]">
        <Product productId="sku-indomie" alt="Instant noodles" delay={0.65} />
      </Floating>
      <Floating px={px} py={py} depth={-20} float={9} period={7.5} delay={0.4} className="w-[36%] right-[3%] top-[48%]">
        <Product productId="sku-beans" alt="Honey beans" delay={0.75} />
      </Floating>

      {/* glass proof card: the seeded order #4082 */}
      <Floating px={px} py={py} depth={30} float={5} period={5.5} delay={1.2} className="left-0 bottom-[1%] w-[min(300px,88%)] sm:w-[min(300px,68%)]">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: SMOOTH, delay: 1.05 }}
          className="rounded-3xl border border-white/15 bg-white/[0.08] p-4 text-cream backdrop-blur-xl shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.12)]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-semibold tracking-tight whitespace-nowrap">Order {SAMPLE_ORDER.id}</p>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-500/15 px-2 py-0.5 text-[11px] font-medium text-accent-300">
              <MapPin className="h-3 w-3" /> {SAMPLE_ORDER.pickupHub}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-cream/55">{SAMPLE_ORDER.batchSlot}</p>
          <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-cream/45">Pickup PIN</p>
              <p className="font-mono text-lg font-semibold tracking-[0.3em]">••{SAMPLE_ORDER.pickupPin.slice(-2)}</p>
            </div>
            <p className="text-xl font-semibold tracking-tight tabular-nums">₦{SAMPLE_ORDER.totalAmount.toLocaleString()}</p>
          </div>
        </motion.div>
      </Floating>

      <Floating px={px} py={py} depth={-26} float={6} period={6} delay={0.2} className="right-0 top-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: SMOOTH, delay: 1.25 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] py-1.5 pl-1.5 pr-3.5 text-cream backdrop-blur-xl"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-500 text-ink">
            <Check className="h-4 w-4" />
          </span>
          <span className="text-xs font-medium">
            {SAMPLE_ITEMS.length} items · {SAMPLE_STALLS} Eke Awka stalls
          </span>
        </motion.div>
      </Floating>
    </div>
  );
}

/** Frosted countdown card with a live pulse. */
function CutoffCard({ mins, secs }) {
  return (
    <div className="mt-10 flex w-full max-w-md items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.05] px-5 py-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-500" />
        </span>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-cream/50">Next cutoff</p>
          <p className="text-sm text-cream/80">
            Midday Break<span className="hidden sm:inline text-cream/50"> · Dynamo · School Gate · Aroma</span>
          </p>
        </div>
      </div>
      <RollingDigits value={`00:${mins}:${secs}`} className="text-2xl sm:text-3xl font-semibold tracking-tight text-cream" />
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

  // Hero: content drifts up and fades as you scroll away; stage sinks slower (depth).
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const stageY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  // Pointer parallax for the stage (desktop pointers only).
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.6 });
  const py = useSpring(my, { stiffness: 60, damping: 18, mass: 0.6 });
  const onPointerMove = (e) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  const qtyOf = (id) => cart.find((c) => c.productId === id)?.qty || 0;
  const rise = (delay) => ({
    initial: { opacity: 0, y: 18, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.9, ease: SMOOTH, delay },
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
      <section
        ref={heroRef}
        onPointerMove={onPointerMove}
        className="relative -mt-16 overflow-hidden rounded-b-[2.5rem] bg-night pt-16 text-cream"
        aria-labelledby="hero-title"
      >
        {/* blended light: deep green from the top-left, warm orange behind the products */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-[20%] -top-[30%] h-[90%] w-[70%] rounded-full bg-brand-600/50 blur-[120px]" />
          <div className="absolute right-[-10%] top-[10%] h-[80%] w-[60%] rounded-full bg-accent-600/25 blur-[140px]" />
          <div className="absolute bottom-[-30%] left-[20%] h-[60%] w-[60%] rounded-full bg-brand-700/40 blur-[120px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(7_19_13/0.7)_100%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto grid items-center gap-8 px-4 sm:px-6 pt-10 pb-20 sm:pt-14 lg:grid-cols-12 lg:gap-4 lg:min-h-[calc(100svh-3.5rem)] lg:py-10">
          <motion.div className="lg:col-span-7" style={reduce ? undefined : { y: copyY, opacity: copyOpacity }}>
            <motion.p
              {...rise(0)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-cream/75 backdrop-blur-md"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              UNIZIK Pilot · Ifite, Tempsite &amp; Aroma
            </motion.p>

            <h1
              id="hero-title"
              className="mt-6 font-display font-semibold text-[2.9rem] leading-[0.98] min-[400px]:text-[3.2rem] sm:text-[4.6rem] lg:text-[5rem] xl:text-[5.8rem] tracking-[-0.055em]"
            >
              <span className="block sm:whitespace-nowrap">
                <Words text="Eke Awka prices." start={0.1} wordClass="bg-gradient-to-b from-cream to-cream/70 bg-clip-text text-transparent" />
              </span>
              <span className="block sm:whitespace-nowrap">
                <Words text="Delivered to your" start={0.3} wordClass="bg-gradient-to-b from-cream to-cream/70 bg-clip-text text-transparent" />
              </span>
              <span className="block sm:whitespace-nowrap font-serif italic font-normal tracking-[-0.02em] text-[1.12em] leading-[0.95]">
                <Words
                  text="lodge junction."
                  start={0.5}
                  wordClass="bg-gradient-to-br from-accent-300 via-accent-500 to-accent-600 bg-clip-text text-transparent pr-[0.06em]"
                />
              </span>
            </h1>

            <motion.p {...rise(0.75)} className="mt-6 max-w-lg text-base sm:text-lg leading-relaxed text-cream/65">
              Skip the market commute and the 25%–35% campus kiosk markup. Join a batch run timed to
              your lecture breaks for a flat ₦350.
            </motion.p>

            <motion.div {...rise(0.9)} className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:gap-3">
              <Button to="/shop" size="lg" variant="accent" className="px-4 sm:px-7">
                Shop this batch
                <ArrowRight className="hidden min-[400px]:block w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
              </Button>
              <Button to="/login" size="lg" variant="onDark" className="px-4 sm:px-7">
                Portal sign in
              </Button>
            </motion.div>

            <motion.div {...rise(1.05)}>
              <CutoffCard mins={mins} secs={secs} />
            </motion.div>
          </motion.div>

          <motion.div className="lg:col-span-5" style={reduce ? undefined : { y: stageY }}>
            <HeroStage px={px} py={py} />
          </motion.div>
        </div>

        <Ticker items={TICKER_ITEMS} label="Hubs, batch times and fees" />
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
