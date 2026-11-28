import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown, Star, ShieldCheck, AlertTriangle, Split, Trophy, UserPlus, Store, Banknote, TrendingUp, Crown, Power, RefreshCw, Loader2, Bike,
} from 'lucide-react';
import { api } from '../lib/api';
import { koboToNaira, prettyDate, statusLabel, toNaira } from '../lib/adapters';
import { getProductImage } from '../data/productImages';
import PageHeader from '../components/ui/PageHeader';
import PortalSection from '../components/ui/PortalSection';
import Reveal from '../components/ui/Reveal';
import { TextField, ActionButton } from '../components/ui/Modal';
import PriceChangeModal from '../components/PriceChangeModal';

const OUT = [0.16, 1, 0.3, 1];
const card = 'rounded-lg bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]';
const PRIORITY_MIN = 4.5;
const AT_MARKET = ['ORDER_PLACED', 'PACKED_AT_MARKET'];

function StatTile({ label, kobo, note, highlight = false, negative = false }) {
  return (
    <Reveal.Item className={`flex flex-col justify-between rounded-lg p-5 ${highlight ? 'bg-brand-700 text-white' : `bg-white text-ink ${card}`}`}>
      <p className={`font-display text-xs font-medium uppercase tracking-[0.16em] ${highlight ? 'text-white/70' : 'text-muted'}`}>{label}</p>
      <p className={`mt-3 font-display text-3xl font-semibold leading-none tabular-nums ${negative && !highlight ? 'text-red-700' : ''}`}>
        {negative ? '−' : ''}{koboToNaira(kobo)}
      </p>
      {note && <p className={`mt-2 text-xs ${highlight ? 'text-white/70' : 'text-muted'}`}>{note}</p>}
    </Reveal.Item>
  );
}

const EMPTY_VENDOR = {
  name: '', email: '', phone: '', password: '', stallName: '', market: 'Eke Awka', stallNumber: '', bankName: '', bankCode: '', bankAccountNumber: '',
};

function OnboardVendorForm({ onCreated }) {
  const [f, setF] = useState(EMPTY_VENDOR);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { user } = await api('/admin/users', {
        method: 'POST',
        body: {
          role: 'VENDOR',
          name: f.name,
          email: f.email,
          password: f.password,
          ...(f.phone && { phone: f.phone }),
          vendor: {
            ...(f.stallName && { stallName: f.stallName }),
            market: f.market,
            stallNumber: f.stallNumber,
            bankName: f.bankName,
            bankCode: f.bankCode,
            bankAccountNumber: f.bankAccountNumber,
          },
        },
      });
      setMsg({ ok: true, text: `${f.stallName || f.name} is onboarded. They sign in as ${user.email} and add their goods and prices in the stall portal.` });
      setF(EMPTY_VENDOR);
      onCreated();
    } catch (err) {
      const detail = err.details?.[0];
      setMsg({ ok: false, text: detail?.message || err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${card} space-y-5 p-6`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Trader's full name" required value={f.name} onChange={set('name')} placeholder="Chioma Eze" />
        <TextField label="Stall name (optional)" value={f.stallName} onChange={set('stallName')} placeholder="Mama Chioma Provisions" />
        <TextField label="Login email" type="email" required value={f.email} onChange={set('email')} />
        <TextField label="Phone (optional)" value={f.phone} onChange={set('phone')} placeholder="08031234567" />
        <TextField label="Temporary password (10+ chars)" type="password" required minLength={10} value={f.password} onChange={set('password')} autoComplete="new-password" />
        <TextField label="Market" required value={f.market} onChange={set('market')} />
        <TextField label="Stall number" required value={f.stallNumber} onChange={set('stallNumber')} placeholder="Line 4, Shop 12" />
        <TextField label="Bank name" required value={f.bankName} onChange={set('bankName')} placeholder="Moniepoint MFB" />
        <TextField label="Bank code" required inputMode="numeric" value={f.bankCode} onChange={set('bankCode')} placeholder="50515" />
        <TextField label="Account number (10 digits)" required inputMode="numeric" maxLength={10} value={f.bankAccountNumber} onChange={set('bankAccountNumber')} />
      </div>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`rounded-md px-4 py-3 text-sm font-semibold ${msg.ok ? 'bg-brand-50 text-brand-700' : 'border-2 border-red-200 bg-red-50 text-red-700'}`}>
          {msg.text}
        </p>
      )}
      <ActionButton type="submit" disabled={busy}>
        <UserPlus className="h-4 w-4" /> {busy ? 'Creating...' : 'Onboard vendor'}
      </ActionButton>
    </form>
  );
}

const EMPTY_RIDER = { name: '', email: '', phone: '', password: '' };

// Riders: create a login, list them, pause / resume (a paused rider is signed out at once).
function RidersPanel() {
  const [riders, setRiders] = useState([]);
  const [f, setF] = useState(EMPTY_RIDER);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const loadRiders = useCallback(async () => {
    try {
      setRiders((await api('/admin/users?role=RIDER')).users);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }, []);
  useEffect(() => {
    loadRiders();
  }, [loadRiders]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { user } = await api('/admin/users', {
        method: 'POST',
        body: { role: 'RIDER', name: f.name, email: f.email, password: f.password, ...(f.phone && { phone: f.phone }) },
      });
      setMsg({ ok: true, text: `${user.name} can now sign in as ${user.email} and lands on the rider dispatch page.` });
      setF(EMPTY_RIDER);
      loadRiders();
    } catch (err) {
      setMsg({ ok: false, text: err.details?.[0]?.message || err.message });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (r) => {
    try {
      await api(`/admin/users/${r.id}`, { method: 'PATCH', body: { isActive: !r.isActive } });
      loadRiders();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={submit} className={`${card} space-y-5 p-6`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Rider's full name" required value={f.name} onChange={set('name')} placeholder="Tunde Bakare" />
          <TextField label="Phone (optional)" value={f.phone} onChange={set('phone')} placeholder="08031234567" />
          <TextField label="Login email" type="email" required value={f.email} onChange={set('email')} />
          <TextField label="Password (10+ chars)" type="password" required minLength={10} value={f.password} onChange={set('password')} autoComplete="new-password" />
        </div>
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={`rounded-md px-4 py-3 text-sm font-semibold ${msg.ok ? 'bg-brand-50 text-brand-700' : 'border-2 border-red-200 bg-red-50 text-red-700'}`}>
            {msg.text}
          </p>
        )}
        <ActionButton type="submit" disabled={busy}>
          <UserPlus className="h-4 w-4" /> {busy ? 'Creating...' : 'Add rider'}
        </ActionButton>
      </form>
      <div className={`${card} overflow-hidden`}>
        {riders.length === 0 ? (
          <p className="p-6 text-muted">No riders yet.</p>
        ) : (
          <ul>
            {riders.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3 last:border-0">
                <span className="text-sm text-ink">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="text-muted">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span>
                </span>
                <button
                  onClick={() => toggle(r)}
                  className="flex h-9 items-center gap-1.5 rounded-md border-2 border-ink/15 px-3 font-display text-[11px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink cursor-pointer"
                >
                  <Power className="h-3.5 w-3.5" /> {r.isActive ? 'Pause' : 'Resume'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [error, setError] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [vendorMsg, setVendorMsg] = useState({});
  const [priceFor, setPriceFor] = useState(null); // { vendor, row }
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, v, o, p] = await Promise.all([api('/admin/summary'), api('/admin/vendors'), api('/admin/orders'), api('/admin/payouts')]);
      setSummary(s);
      setVendors(v.vendors);
      setOrders(o.orders);
      setPayouts(p.payouts);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateVendor = async (vendor, patch) => {
    setVendorMsg((m) => ({ ...m, [vendor.id]: '' }));
    try {
      await api(`/admin/vendors/${vendor.id}`, { method: 'PATCH', body: patch });
      load();
    } catch (err) {
      setVendorMsg((m) => ({ ...m, [vendor.id]: err.message }));
    }
  };

  const runPayouts = async () => {
    setRunning(true);
    setRunResult('');
    try {
      const res = await api('/admin/payouts/run', { method: 'POST' });
      const paid = res.results.filter((r) => r.status === 'PAID' || r.status === 'PROCESSING').length;
      setRunResult(res.attempted === 0 ? 'Nothing to pay right now.' : `Sent ${paid} of ${res.attempted} payout(s).`);
      load();
    } catch (err) {
      setRunResult(err.message);
    } finally {
      setRunning(false);
    }
  };

  // Batches still at the market that contain this vendor's product.
  const batchesFor = (vendorId, productId) => {
    const seen = new Map();
    for (const o of orders) {
      if (!AT_MARKET.includes(o.status)) continue;
      if (!o.items.some((i) => i.vendor.id === vendorId && i.product.id === productId && !i.riderPickedUp && !i.refundedAt)) continue;
      const key = `${o.batchDate}|${o.batchSlotId}`;
      if (!seen.has(key)) seen.set(key, { batchDate: o.batchDate, batchSlotId: o.batchSlotId, label: 'Evening Delivery' });
    }
    return [...seen.values()];
  };

  const money = summary?.money;
  const paidOrders = summary?.orders.paidAndActive || 0;
  const perOrder = (kobo) => (paidOrders ? Math.round(kobo / paidOrders) : 0);
  const payoutTotals = useMemo(() => summary?.payouts || {}, [summary]);

  const sections = [
    { href: '#economics', label: 'Unit economics' },
    { href: '#vendors', label: 'Vendors & prices' },
    { href: '#onboard', label: 'Onboard vendor' },
    { href: '#riders', label: 'Riders' },
    { href: '#payouts', label: 'Payouts' },
    { href: '#inspector', label: 'Order splits' },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader kicker="Ops & unit economics" title="Operations dashboard">
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
          <p className="max-w-2xl text-white/75">
            One evening batch, Monday to Saturday. Cutoff 3:00 PM, stalls packed by 4:00 PM, campus pickup from 5:00 PM. Vendors under 3.5★ stop receiving orders.
          </p>
          <button
            onClick={load}
            className="flex h-10 items-center gap-2 rounded-md border-2 border-white/60 px-4 font-display text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors duration-300 hover:bg-white hover:text-ink active:scale-[0.97] cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </PageHeader>

      <nav className="sticky top-16 z-30 bg-white shadow-[0_6px_20px_-14px_rgb(0_0_0/0.35)]" aria-label="Dashboard sections">
        <div className="max-w-6xl mx-auto flex gap-7 overflow-x-auto px-4 sm:px-6">
          {sections.map((s) => (
            <a key={s.href} href={s.href} className="group/nav relative shrink-0 py-4 font-display text-xs font-medium uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink">
              {s.label}
              <span className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-accent-500 transition-transform duration-300 group-hover/nav:scale-x-100" />
            </a>
          ))}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 space-y-14">
        {error && <p role="alert" className="rounded-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {/* Unit economics */}
        <section id="economics" className="scroll-mt-32">
          <PortalSection kicker={`${paidOrders} paid order(s) · per-order figures in the notes`} title="Unit economics" icon={TrendingUp}>
            {!money ? (
              <p className={`${card} p-6 text-muted`}>Loading...</p>
            ) : (
              <Reveal stagger={0.05} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile label="Sales (GMV)" kobo={money.salesKobo} note={`${koboToNaira(perOrder(money.salesKobo))} per order`} />
                <StatTile label="Item margin" kobo={money.itemMarginKobo} note={`${koboToNaira(perOrder(money.itemMarginKobo))} per order`} />
                <StatTile label="Delivery fees" kobo={money.deliveryFeesKobo} note={`${koboToNaira(perOrder(money.deliveryFeesKobo))} per order`} />
                <StatTile label="Cancellation fees" kobo={money.cancellationFeesKobo} note="₦200 per cancel before cutoff" />
                <StatTile label="Rider commission" kobo={money.riderEarningsKobo} negative note="₦150 per handover" />
                <StatTile label="Monnify fees" kobo={money.paymentFeesKobo} negative note="₦50 per paid order" />
                <StatTile label="Packaging" kobo={money.packagingKobo} negative note="~₦70 tagged bags per order" />
                <StatTile label="Gross profit" kobo={money.grossProfitKobo} highlight note={`${koboToNaira(perOrder(money.grossProfitKobo))} per order`} />
                <StatTile label="Price spikes absorbed" kobo={money.priceSpikeAbsorbedKobo} note="Inside item margin (≤ ₦150/unit rule)" />
                <StatTile label="Refunds to wallets" kobo={money.refundsKobo + money.itemRefundsKobo} note="Cancels + price-spike refunds" />
                <StatTile label="Student wallets held" kobo={money.studentWalletBalancesKobo} note="Money we owe students" />
                <StatTile label="Vendor payouts pending" kobo={(payoutTotals.PENDING?.amountKobo || 0) + (payoutTotals.FAILED?.amountKobo || 0)} note={`${koboToNaira(payoutTotals.PAID?.amountKobo || 0)} paid so far`} />
              </Reveal>
            )}
          </PortalSection>
        </section>

        {/* Vendors, goods and prices */}
        <div id="vendors" className="scroll-mt-32">
          <PortalSection kicker="Routing follows rating · priority stalls get first pick" title="Vendors, goods & prices" icon={Trophy}>
            <div className={`${card} overflow-hidden`}>
              {vendors.length === 0 && <p className="p-6 text-muted">No vendors yet.</p>}
              {vendors.map((v) => {
                const open = expandedVendor === v.id;
                const suspended = v.ratingScore < 3.5;
                const canPriority = v.ratingScore >= PRIORITY_MIN;
                return (
                  <div key={v.id} className="border-b border-ink/10 last:border-0">
                    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                      <button onClick={() => setExpandedVendor(open ? null : v.id)} aria-expanded={open} className="flex items-center gap-3 text-left cursor-pointer">
                        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.25 }}>
                          <ChevronDown className="h-5 w-5 text-muted" />
                        </motion.span>
                        <span>
                          <span className="block font-display text-xl font-medium uppercase text-ink">
                            {v.name} {v.priorityTier && <Crown className="ml-1 inline h-4 w-4 text-accent-600" aria-label="Priority supplier" />}
                          </span>
                          <span className="block text-sm text-muted">
                            {v.market} · {v.stallNumber} · {v.inventory.length} product(s) · {v.user?.email || 'no login'}
                          </span>
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="flex items-center gap-1.5 font-display text-lg font-medium text-ink">
                          <Star className="h-5 w-5 fill-accent-500 text-accent-500" /> {v.ratingScore.toFixed(2)}
                          <span className="text-sm text-muted">({v.ratingCount})</span>
                        </span>
                        {!v.isActive ? (
                          <span className="rounded bg-ink/10 px-2.5 py-1.5 font-display text-[11px] uppercase tracking-[0.1em] text-muted">Paused</span>
                        ) : suspended ? (
                          <span className="flex items-center gap-1.5 rounded bg-red-100 px-2.5 py-1.5 font-display text-[11px] uppercase tracking-[0.1em] text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5" /> Below 3.5★
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded bg-brand-50 px-2.5 py-1.5 font-display text-[11px] uppercase tracking-[0.1em] text-brand-700">
                            <ShieldCheck className="h-3.5 w-3.5" /> Receiving orders
                          </span>
                        )}
                        <button
                          onClick={() => updateVendor(v, { priorityTier: !v.priorityTier })}
                          disabled={!v.priorityTier && !canPriority}
                          title={canPriority || v.priorityTier ? 'Priority Supplier Tier: first pick in routing' : `Needs ${PRIORITY_MIN}★ or more`}
                          aria-pressed={v.priorityTier}
                          className={`flex h-9 items-center gap-1.5 rounded-md px-3 font-display text-[11px] font-medium uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${
                            v.priorityTier ? 'bg-accent-500 text-ink' : 'border-2 border-ink/15 text-ink hover:border-ink'
                          }`}
                        >
                          <Crown className="h-3.5 w-3.5" /> {v.priorityTier ? 'Priority on' : 'Priority off'}
                        </button>
                        <button
                          onClick={() => updateVendor(v, { isActive: !v.isActive })}
                          aria-pressed={v.isActive}
                          className="flex h-9 items-center gap-1.5 rounded-md border-2 border-ink/15 px-3 font-display text-[11px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink cursor-pointer"
                        >
                          <Power className="h-3.5 w-3.5" /> {v.isActive ? 'Pause' : 'Resume'}
                        </button>
                      </div>
                    </div>
                    {vendorMsg[v.id] && <p role="alert" className="px-5 pb-3 text-sm font-semibold text-red-600">{vendorMsg[v.id]}</p>}

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: OUT }} className="overflow-hidden">
                          <div className="px-5 pb-5">
                            <p className="mb-3 text-sm text-muted">
                              Bank: {v.bankName} ({v.bankCode}) · {v.bankAccountNumber} · paid out {koboToNaira(v.payoutBalanceKobo)}
                            </p>
                            {v.inventory.length === 0 ? (
                              <p className="rounded-md bg-canvas p-4 text-sm text-muted">No goods listed yet. The vendor adds them in their stall portal.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-md border border-ink/10">
                                <table className="w-full min-w-[640px] text-sm">
                                  <thead className="bg-canvas text-left font-display text-[11px] uppercase tracking-[0.12em] text-muted">
                                    <tr>
                                      <th className="px-3 py-2">Product</th>
                                      <th className="px-3 py-2 text-right">Wholesale</th>
                                      <th className="px-3 py-2 text-right">Student price</th>
                                      <th className="px-3 py-2 text-right">Margin</th>
                                      <th className="px-3 py-2 text-right">Stock</th>
                                      <th className="px-3 py-2" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {v.inventory.map((row) => {
                                      const margin = row.product.studentPriceKobo - row.wholesalePriceKobo;
                                      return (
                                        <tr key={row.productId} className="border-t border-ink/10">
                                          <td className="px-3 py-2">
                                            <span className="flex items-center gap-2">
                                              <span className="h-8 w-8 shrink-0 rounded bg-tile p-0.5">
                                                {getProductImage(row.productId) && <img src={getProductImage(row.productId)} alt="" className="h-full w-full object-contain" />}
                                              </span>
                                              <span className="font-semibold text-ink">{row.product.name}</span>
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-right tabular-nums">{koboToNaira(row.wholesalePriceKobo)}</td>
                                          <td className="px-3 py-2 text-right tabular-nums">{koboToNaira(row.product.studentPriceKobo)}</td>
                                          <td className={`px-3 py-2 text-right font-semibold tabular-nums ${margin < 0 ? 'text-red-700' : 'text-brand-700'}`}>{koboToNaira(margin)}</td>
                                          <td className={`px-3 py-2 text-right tabular-nums ${row.stockQty === 0 ? 'text-red-700' : ''}`}>{row.stockQty}</td>
                                          <td className="px-3 py-2 text-right">
                                            <button
                                              onClick={() => setPriceFor({ vendor: v, row })}
                                              className="inline-flex items-center gap-1 rounded border-2 border-ink/15 px-2 py-1 font-display text-[10px] uppercase tracking-[0.1em] text-ink hover:border-accent-500 cursor-pointer"
                                            >
                                              <TrendingUp className="h-3 w-3" /> Price rise
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </PortalSection>
        </div>

        {/* Onboarding */}
        <div id="onboard" className="scroll-mt-32">
          <PortalSection kicker="Stall login + bank details for instant payouts" title="Onboard a vendor" icon={Store}>
            <OnboardVendorForm onCreated={load} />
          </PortalSection>
        </div>

        {/* Riders */}
        <div id="riders" className="scroll-mt-32">
          <PortalSection kicker="Dispatch logins for the evening run" title="Riders" icon={Bike}>
            <RidersPanel />
          </PortalSection>
        </div>

        {/* Payouts */}
        <div id="payouts" className="scroll-mt-32">
          <PortalSection
            kicker="Paid by bank transfer (Monnify) when the rider collects"
            title="Vendor payouts"
            icon={Banknote}
            aside={
              <button
                onClick={runPayouts}
                disabled={running}
                className="flex h-11 items-center gap-2 rounded-md bg-ink px-5 font-display text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-accent-500 hover:text-ink disabled:opacity-50 cursor-pointer"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Retry pending payouts
              </button>
            }
          >
            {runResult && <p role="status" className="mb-3 text-sm font-semibold text-ink">{runResult}</p>}
            {payouts.length === 0 ? (
              <p className={`${card} p-6 text-muted`}>No stall pickups yet.</p>
            ) : (
              <ul className={`${card} overflow-hidden`}>
                {payouts.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3 last:border-0">
                    <span className="text-sm text-ink">
                      <span className="font-semibold">{p.vendor.name}</span> · {prettyDate(p.batchDate)}
                      {p.payoutFailureReason && <span className="block text-xs text-red-600">{p.payoutFailureReason}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-display text-lg font-semibold tabular-nums">{koboToNaira(p.payoutKobo)}</span>
                      <span
                        className={`rounded px-2 py-1 font-display text-[11px] uppercase tracking-[0.1em] ${
                          p.payoutStatus === 'PAID' ? 'bg-brand-50 text-brand-700' : p.payoutStatus === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-accent-100 text-accent-700'
                        }`}
                      >
                        {p.payoutStatus}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PortalSection>
        </div>

        {/* Split inspector */}
        <div id="inspector" className="scroll-mt-32">
          <PortalSection kicker="Latest 50 orders · line items per stall" title="Order split inspector" icon={Split}>
            <div className={`${card} overflow-hidden`}>
              {orders.length === 0 && <p className="p-6 text-muted">No orders yet.</p>}
              {orders.map((order) => {
                const isOpen = expandedOrder === order.id;
                return (
                  <div key={order.id} className="border-b border-ink/10 last:border-0">
                    <button
                      onClick={() => setExpandedOrder(isOpen ? null : order.id)}
                      aria-expanded={isOpen}
                      className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-canvas cursor-pointer"
                    >
                      <span className="flex flex-wrap items-center gap-3">
                        <motion.span animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.25 }}>
                          <ChevronDown className="h-5 w-5 text-muted" />
                        </motion.span>
                        <span className="font-display text-xl font-medium uppercase text-ink">{order.orderLabel}</span>
                        <span className="text-sm text-muted">{order.student.name} · {order.hub.name} · {prettyDate(order.batchDate)}</span>
                        {order.requiresBagMerge && (
                          <span className="rounded bg-accent-100 px-2 py-1 font-display text-[11px] uppercase tracking-[0.1em] text-accent-700">Split-stall · merge bag</span>
                        )}
                      </span>
                      <span className="flex items-center gap-4">
                        <span className={`rounded px-2 py-1 font-display text-[11px] uppercase tracking-[0.1em] ${order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-ink text-white'}`}>
                          {statusLabel(order.status)}
                        </span>
                        <span className="font-display text-xl font-semibold text-ink tabular-nums">{koboToNaira(order.totalKobo)}</span>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: OUT }} className="overflow-hidden">
                          <ul className="space-y-2 px-5 pb-5">
                            {order.items.map((item) => (
                              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-canvas p-3">
                                <span className="flex items-center gap-3">
                                  <span className="h-10 w-10 shrink-0 rounded bg-tile p-1">
                                    {getProductImage(item.product.id) && <img src={getProductImage(item.product.id)} alt="" className="h-full w-full object-contain" />}
                                  </span>
                                  <span>
                                    <span className="block text-sm font-semibold text-ink">{item.qty}× {item.product.name}</span>
                                    <span className="block text-sm text-muted">→ {item.vendor.name} ({item.vendor.stallNumber})</span>
                                  </span>
                                </span>
                                <span className="flex flex-wrap items-center gap-4 text-sm">
                                  <span className="text-muted">Wholesale {koboToNaira(item.wholesaleCostKobo * item.qty)}</span>
                                  <span className="font-semibold text-ink">Retail {koboToNaira(item.studentPriceKobo * item.qty)}</span>
                                  {item.refundedAt && <span className="rounded bg-ink/10 px-2 py-1 font-display text-[11px] uppercase text-muted">Refunded {koboToNaira(item.refundKobo)}</span>}
                                  {item.issueTag && (
                                    <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-1 font-display text-[11px] uppercase tracking-[0.08em] text-red-700">
                                      <AlertTriangle className="h-3.5 w-3.5" /> {item.issueTag}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </PortalSection>
        </div>
      </div>

      <PriceChangeModal
        open={Boolean(priceFor)}
        onClose={() => setPriceFor(null)}
        endpoint={priceFor ? `/admin/vendors/${priceFor.vendor.id}/price-change` : ''}
        product={priceFor && { id: priceFor.row.productId, name: `${priceFor.row.product.name} (${priceFor.vendor.name})` }}
        currentPrice={priceFor ? toNaira(priceFor.row.wholesalePriceKobo) : 0}
        batches={priceFor ? batchesFor(priceFor.vendor.id, priceFor.row.productId) : []}
        onDone={load}
      />
    </div>
  );
}
