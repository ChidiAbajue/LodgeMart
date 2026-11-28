import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Clock, Store, Bike, MapPin, KeyRound } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import { CAMPUS_ZONES, ALL_HUBS, BATCH_SLOTS, INITIAL_ORDERS } from '../data/seedData';
import { getProductImage } from '../data/productImages';
import { naira } from '../lib/format';
import Button from '../components/ui/Button';
import ProductCard from '../components/ui/ProductCard';
import SectionHeader from '../components/ui/SectionHeader';
import RollingDigits from '../components/ui/RollingDigits';
import Reveal from '../components/ui/Reveal';
import Footer from '../components/Footer';

const SNAP = [0.7, 0, 0.2, 1];
const OUT = [0.16, 1, 0.3, 1];
const SAMPLE_PIN = INITIAL_ORDERS[0].pickupPin;

const wrap = 'max-w-7xl mx-auto px-4 sm:px-6';

/* ---------------- Hero ---------------- */

function HeroLine({ children, delay, className = '' }) {
  return (
    <span className="block overflow-hidden pb-[0.04em]">
      <motion.span
        className={`block ${className}`}
        initial={{ y: '105%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.9, ease: SNAP, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function Hero({ mins, secs }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const dishSpin = useTransform(scrollY, [0, 900], [0, 140]);
  const bgY = useTransform(scrollY, [0, 900], [0, 180]);

  const fade = (delay) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: OUT, delay },
  });

  return (
    <section className="relative -mt-16" aria-labelledby="hero-title">
      <div
        className="relative overflow-hidden bg-ink text-white"
        style={{ borderBottomLeftRadius: '50% 80px', borderBottomRightRadius: '50% 80px' }}
      >
        {/* Eke Awka market, slow settle + scroll parallax */}
        <motion.div className="absolute inset-0" style={reduce ? undefined : { y: bgY }}>
          <motion.picture
            className="block h-full w-full"
            initial={{ scale: 1.18 }}
            animate={{ scale: 1.04 }}
            transition={{ duration: 2.2, ease: OUT }}
          >
            <source media="(max-width: 640px)" srcSet="/images/hero-eke-awka-m.webp" />
            <img
              src="/images/hero-eke-awka.webp"
              alt=""
              width="1600"
              height="900"
              fetchPriority="high"
              className="h-full w-full object-cover"
            />
          </motion.picture>
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/60 to-brand-900/85" />

        <div className={`relative ${wrap} flex min-h-[92svh] flex-col items-center justify-center pt-32 pb-44 sm:pb-52 text-center`}>
          <motion.p
            {...fade(0)}
            className="flex items-center gap-3 font-display text-[11px] sm:text-xs font-medium uppercase tracking-[0.18em] sm:tracking-[0.3em] text-accent-400"
          >
            <span className="hidden sm:block h-px w-8 bg-accent-400/70" />
            UNIZIK Pilot · Ifite, Tempsite &amp; Aroma
            <span className="hidden sm:block h-px w-8 bg-accent-400/70" />
          </motion.p>

          <h1
            id="hero-title"
            className="mt-6 font-display font-semibold uppercase leading-[0.95] tracking-[-0.01em] text-[2.9rem] min-[400px]:text-[3.3rem] sm:text-7xl lg:text-[6.5rem]"
          >
            <HeroLine delay={0.1}>Eke Awka prices,</HeroLine>
            <HeroLine delay={0.2}>delivered to your</HeroLine>
            <HeroLine delay={0.3} className="text-accent-500">lodge junction.</HeroLine>
          </h1>

          <motion.p {...fade(0.55)} className="mt-7 max-w-xl text-base sm:text-lg leading-relaxed text-white/80">
            Skip the market commute and the 25%–35% campus kiosk markup. Join a batch run timed to your
            lecture breaks for a flat ₦350.
          </motion.p>

          <motion.div {...fade(0.7)} className="mt-9 flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
            <Button to="/shop" size="lg" variant="accent">
              Shop this batch <ArrowRight className="h-4 w-4" />
            </Button>
            <Button to="/login" size="lg" variant="outlineLight">
              Portal sign in
            </Button>
          </motion.div>

          <motion.div
            {...fade(0.85)}
            className="mt-9 inline-flex items-center gap-3 border-y border-white/20 py-3 font-display uppercase"
          >
            <Clock className="h-4 w-4 text-accent-400" />
            <span className="text-xs tracking-[0.2em] text-white/70">Next cutoff · Midday Break</span>
            <RollingDigits value={`00:${mins}:${secs}`} className="text-2xl font-medium tracking-[0.04em] text-white" />
          </motion.div>
        </div>
      </div>

      {/* the dish that breaks the curve */}
      <motion.div
        className="absolute left-1/2 bottom-0 z-10 w-[230px] sm:w-[300px] lg:w-[360px] -translate-x-1/2 translate-y-[48%]"
        initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -120 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.5 }}
      >
        <motion.img
          src={getProductImage('sku-beans')}
          alt="A dish of honey beans from an Eke Awka stall"
          width="800"
          height="800"
          className="w-full drop-shadow-[0_28px_30px_rgb(0_0_0/0.35)]"
          style={reduce ? undefined : { rotate: dishSpin }}
        />
      </motion.div>
    </section>
  );
}

/* ---------------- Promises (three circles) ---------------- */

function PinDisc() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-brand-700 text-white">
      <span className="font-display text-[11px] uppercase tracking-[0.3em] text-accent-400">Pickup PIN</span>
      <span className="mt-2 font-display text-4xl font-semibold tracking-[0.18em]">••{SAMPLE_PIN.slice(-2)}</span>
    </div>
  );
}

const PROMISES = [
  {
    title: 'Junction batch drops',
    body: 'Pick up at Dynamo Junction, School Gate, or Aroma Junction between lectures for a flat ₦350.',
    img: '/images/market-evening.webp',
  },
  {
    title: '4-digit PIN & roommate delegate',
    body: 'Stuck in a lab? Rotate your PIN and delegate pickup to your roommate via WhatsApp in one tap.',
    disc: PinDisc,
    offset: true,
  },
  {
    title: '100% instant vendor payouts',
    body: 'Traders at Eke Awka get paid 100% on rider pickup with zero holdback, so stock stays fresh.',
    img: '/images/peppers.webp',
  },
];

function Promises() {
  return (
    <section className="bg-canvas pt-40 sm:pt-48 pb-20 sm:pb-28" aria-label="Why LodgeMart">
      <Reveal stagger={0.15} amount={0.2} className={`${wrap} grid gap-14 md:grid-cols-3 md:gap-10`}>
        {PROMISES.map(({ title, body, img, disc: Disc, offset }) => (
          <Reveal.Item key={title} className={`flex flex-col items-center text-center ${offset ? 'md:mt-16' : ''}`}>
            <Reveal.Item variant="scale" className="h-44 w-44 sm:h-52 sm:w-52 overflow-hidden rounded-full ring-8 ring-white shadow-[0_20px_40px_-20px_rgb(0_0_0/0.4)]">
              {Disc ? <Disc /> : <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </Reveal.Item>
            <h3 className="mt-8 font-display text-2xl sm:text-[1.7rem] font-medium uppercase text-accent-600">{title}</h3>
            <p className="mt-3 max-w-xs text-[0.95rem] leading-relaxed text-muted">{body}</p>
          </Reveal.Item>
        ))}
      </Reveal>
    </section>
  );
}

/* ---------------- How a batch works (dark photo band) ---------------- */

const STEPS = [
  { icon: Store, title: 'Order before cutoff', body: 'Pick from verified Eke Awka stalls at market prices.' },
  { icon: Bike, title: 'One rider per batch', body: 'Packed at the stalls, collected in one run.' },
  { icon: MapPin, title: 'Drop at your junction', body: 'Dynamo Junction, School Gate or Aroma Junction.' },
  { icon: KeyRound, title: 'Collect with your PIN', body: 'Show your 4-digit PIN, or delegate it.' },
];

function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-ink text-white" aria-labelledby="how-title">
      <img src="/images/rider-band.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/60" />
      <div className={`relative ${wrap} grid gap-12 py-20 sm:py-28 lg:grid-cols-12 lg:items-center`}>
        <Reveal className="lg:col-span-4" variant="left">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-accent-400">How a batch works</p>
          <h2 id="how-title" className="mt-4 font-display text-5xl sm:text-6xl font-semibold uppercase leading-[0.98]">
            Market to hub in four steps
          </h2>
        </Reveal>
        <Reveal stagger={0.12} className="lg:col-span-8 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <Reveal.Item key={title} className="flex flex-col items-center text-center">
              <motion.span
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent-500 text-ink"
                whileHover={reduce ? undefined : { rotate: [0, -8, 8, 0], transition: { duration: 0.4 } }}
              >
                <Icon className="h-8 w-8" strokeWidth={1.75} />
                <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white font-display text-xs font-semibold text-ink">
                  {i + 1}
                </span>
              </motion.span>
              <h3 className="mt-5 font-display text-lg sm:text-xl font-medium uppercase leading-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{body}</p>
            </Reveal.Item>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Products ---------------- */

function InThisBatch({ products, qtyOf, addToCart, updateCartQty }) {
  return (
    <section className="bg-white py-20 sm:py-28" aria-labelledby="picks-title">
      <div className={wrap}>
        <SectionHeader id="picks-title" kicker="Fresh from Eke Awka stalls" title="In this batch" />
        <Reveal stagger={0.07} amount={0.1} className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {products.map((p) => (
            <Reveal.Item key={p.id}>
              <ProductCard product={p} qty={qtyOf(p.id)} onAdd={(id) => addToCart(id, 1)} onChangeQty={updateCartQty} />
            </Reveal.Item>
          ))}
        </Reveal>
        <div className="mt-14 flex justify-center">
          <Button to="/shop" variant="outline">
            View full market <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Categories (cards with product art) ---------------- */

function Categories({ products }) {
  const groups = [
    { title: 'Grains & staples', match: ['Grains & Staples'], img: 'sku-garri' },
    { title: 'Noodles & pasta', match: ['Noodles & Pasta'], img: 'sku-indomie' },
    { title: 'Provisions & essentials', match: ['Provisions', 'Hostel Essentials', 'Cooking Oils'], img: 'sku-oil' },
  ];
  return (
    <section className="bg-tile py-20 sm:py-24" aria-label="Shop by category">
      <Reveal stagger={0.12} className={`${wrap} grid gap-5 md:grid-cols-3`}>
        {groups.map(({ title, match, img }) => {
          const names = products.filter((p) => match.includes(p.category)).map((p) => p.name);
          return (
            <Reveal.Item
              key={title}
              className="group relative flex min-h-64 flex-col overflow-hidden rounded-lg bg-white p-7 shadow-[0_2px_10px_-4px_rgb(0_0_0/0.12)] transition-shadow duration-300 hover:shadow-[0_24px_40px_-20px_rgb(0_0_0/0.3)]"
            >
              <h3 className="font-display text-2xl font-medium uppercase text-ink">{title}</h3>
              <p className="mt-2 max-w-[60%] text-sm leading-relaxed text-muted">{names.join(', ')}</p>
              <div className="mt-auto pt-6">
                <Button to="/shop" size="sm" variant="primary">
                  Shop now <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <img
                src={getProductImage(img)}
                alt=""
                loading="lazy"
                className="pointer-events-none absolute -bottom-6 -right-6 w-[52%] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-2 group-hover:-translate-y-2 group-hover:scale-105"
              />
            </Reveal.Item>
          );
        })}
      </Reveal>
    </section>
  );
}

/* ---------------- Kiosk markup banner ---------------- */

function MarkupBanner() {
  return (
    <section aria-label="Kiosk markup">
      <div className="relative bg-ink text-white">
        <Reveal className={`${wrap} flex flex-col items-start gap-6 py-12 sm:flex-row sm:items-center sm:justify-between`} variant="up">
          <h2 className="font-display text-3xl sm:text-4xl font-medium uppercase leading-tight">
            Skip the <span className="text-accent-500">25%–35%</span> campus kiosk markup.
          </h2>
          <Button to="/shop" variant="accent">
            Shop this batch <ArrowRight className="h-4 w-4" />
          </Button>
        </Reveal>
        <span aria-hidden="true" className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[14px] border-x-transparent border-t-ink" />
      </div>
      <p className="bg-tile py-5 text-center font-display text-base sm:text-lg uppercase tracking-[0.08em] text-ink">
        Flat ₦350 per batch · Pay with LodgeMart Wallet or Paystack
      </p>
    </section>
  );
}

/* ---------------- Best deals (slash cards) ---------------- */

function DealCard({ product, big = false, from = 'left' }) {
  const save = product.kioskComparePrice - product.studentPrice;
  return (
    <Reveal
      variant={from}
      className={`group relative grid overflow-hidden rounded-lg bg-tile ${big ? 'min-h-72 sm:grid-cols-2' : 'min-h-64 grid-cols-2'}`}
    >
      <div className="relative flex items-center justify-center p-6">
        <img
          src={getProductImage(product.id)}
          alt={product.name}
          loading="lazy"
          className={`${big ? 'w-[80%]' : 'w-full'} transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-hover:rotate-[-4deg]`}
        />
        <span className={`absolute left-4 top-4 flex flex-col items-center justify-center rounded-full bg-brand-700 font-display uppercase leading-none text-white ${big ? 'h-24 w-24' : 'h-20 w-20'}`}>
          <span className="text-[11px] tracking-[0.12em]">Save</span>
          <span className={`${big ? 'text-xl' : 'text-base'} mt-1 font-semibold`}>{naira(save)}</span>
        </span>
      </div>
      <div
        className={`relative flex flex-col justify-center bg-accent-500 text-ink ${big ? 'px-8 py-10 sm:pl-20' : 'px-5 py-6 pl-10'}`}
        style={{ clipPath: 'polygon(14% 0, 100% 0, 100% 100%, 0 100%)' }}
      >
        <p className="font-display text-[11px] uppercase tracking-[0.25em]">{product.category}</p>
        <h3 className={`mt-2 font-display font-semibold uppercase leading-[1] ${big ? 'text-4xl sm:text-5xl' : 'text-2xl'}`}>{product.name}</h3>
        <p className="mt-1 text-sm">{product.unit}</p>
        <p className={`mt-4 font-display font-semibold leading-none ${big ? 'text-6xl sm:text-7xl' : 'text-4xl'}`}>{naira(product.studentPrice)}</p>
        <p className="mt-2 text-sm line-through opacity-70">Kiosk {naira(product.kioskComparePrice)}</p>
      </div>
    </Reveal>
  );
}

function BestDeals({ products }) {
  const ranked = [...products].sort(
    (a, b) => b.kioskComparePrice - b.studentPrice - (a.kioskComparePrice - a.studentPrice)
  );
  const [first, second, third] = ranked;
  if (!first) return null;
  return (
    <section className="bg-canvas py-20 sm:py-28" aria-labelledby="deals-title">
      <div className={wrap}>
        <SectionHeader
          id="deals-title"
          kicker="This batch"
          title="Best deals"
          align="left"
          action={
            <Button to="/shop" variant="outline" size="sm">
              View all
            </Button>
          }
        />
        <div className="grid gap-5">
          <DealCard product={first} big from="left" />
          <div className="grid gap-5 md:grid-cols-2">
            {second && <DealCard product={second} from="left" />}
            {third && <DealCard product={third} from="right" />}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Pickup hubs + batch times ---------------- */

function Hubs() {
  return (
    <section className="bg-white py-20 sm:py-28" aria-labelledby="hubs-title">
      <div className={wrap}>
        <SectionHeader
          id="hubs-title"
          kicker="Our pickup hubs"
          title="Collect near your lodge"
          lede="Every batch drops at a junction hub. Show your PIN, take your bag, back to class."
        />
        <Reveal stagger={0.1} className="grid gap-10 text-center sm:grid-cols-3">
          {ALL_HUBS.map((hub) => {
            const zones = CAMPUS_ZONES.filter((z) => z.hubs.includes(hub)).map((z) => z.name);
            return (
              <Reveal.Item key={hub}>
                <h3 className="font-display text-3xl font-medium uppercase text-accent-600">{hub}</h3>
                <p className="mt-2 text-sm font-semibold text-ink">{zones.join(' · ')}</p>
              </Reveal.Item>
            );
          })}
        </Reveal>
        <Reveal stagger={0.1} className="mt-16 grid gap-4 sm:grid-cols-3">
          {BATCH_SLOTS.map((slot) => (
            <Reveal.Item key={slot.id} className="rounded-lg border-2 border-ink/10 p-6 text-center transition-colors duration-300 hover:border-accent-500">
              <p className="font-display text-xs uppercase tracking-[0.25em] text-accent-700">{slot.badge}</p>
              <p className="mt-2 font-display text-2xl font-medium uppercase text-ink">{slot.label}</p>
              <p className="mt-1 text-base text-ink">{slot.time}</p>
              <p className="mt-1 text-sm text-muted">Order by {slot.cutoff}</p>
            </Reveal.Item>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Savings band ---------------- */

function Savings() {
  const [monthlySpend, setMonthlySpend] = useState(35000);
  const estimatedMonthlySavings = Math.round(monthlySpend * 0.28);
  return (
    <section className="bg-accent-500 text-ink" aria-labelledby="savings-title">
      <div className={`${wrap} grid gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:items-center`}>
        <Reveal variant="left">
          <p className="font-display text-xs uppercase tracking-[0.3em]">Savings calculator</p>
          <h2 id="savings-title" className="mt-3 font-display text-4xl sm:text-5xl font-semibold uppercase leading-[1]">
            What kiosks cost you each month
          </h2>
          <label htmlFor="spend" className="mt-8 flex items-center justify-between font-display text-sm uppercase tracking-[0.12em]">
            <span>Monthly foodstuff spend</span>
            <span className="text-lg tabular-nums">₦{monthlySpend.toLocaleString()}</span>
          </label>
          <input
            id="spend"
            type="range"
            min={10000}
            max={100000}
            step={5000}
            value={monthlySpend}
            onChange={(e) => setMonthlySpend(Number(e.target.value))}
            className="lm-range mt-4 w-full cursor-pointer"
          />
        </Reveal>
        <Reveal variant="right" className="lg:text-right">
          <p className="font-display text-sm uppercase tracking-[0.2em]">Estimated monthly savings vs. campus lodge kiosks</p>
          <p className="mt-2 font-display text-7xl sm:text-8xl lg:text-9xl font-semibold leading-none tracking-[-0.02em] text-white [text-shadow:0_4px_0_rgb(19_32_26/0.15)]">
            ₦<RollingDigits value={estimatedMonthlySavings.toLocaleString()} />
          </p>
          <Button to="/shop" variant="dark" className="mt-8">
            Start saving this batch <ArrowRight className="h-4 w-4" />
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Page ---------------- */

export default function LandingPage() {
  const { products, cart, addToCart, updateCartQty } = useLodgeMart();
  const [secondsLeft, setSecondsLeft] = useState(42 * 60 + 15);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 45 * 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const qtyOf = (id) => cart.find((c) => c.productId === id)?.qty || 0;

  return (
    <div className="min-h-screen bg-canvas">
      <Hero mins={mins} secs={secs} />
      <Promises />
      <HowItWorks />
      <InThisBatch products={products} qtyOf={qtyOf} addToCart={addToCart} updateCartQty={updateCartQty} />
      <Categories products={products} />
      <MarkupBanner />
      <BestDeals products={products} />
      <Hubs />
      <Savings />
      <Footer />
    </div>
  );
}
