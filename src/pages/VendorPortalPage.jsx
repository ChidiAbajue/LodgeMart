import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Wallet, Check, Package, Save, Plus, ShoppingBag, TrendingUp, Clock, Star, MessageSquareWarning, Receipt, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useLodgeMart } from '../context/LodgeMartContext';
import { koboToNaira, prettyDate, secondsToNextCutoff, toNaira } from '../lib/adapters';
import { getProductImage } from '../data/productImages';
import PageHeader from '../components/ui/PageHeader';
import PortalSection from '../components/ui/PortalSection';
import Reveal from '../components/ui/Reveal';
import PriceChangeModal from '../components/PriceChangeModal';

const OUT = [0.16, 1, 0.3, 1];
const card = 'rounded-lg bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]';

function Thumb({ productId, className = 'h-12 w-12' }) {
  const src = getProductImage(productId);
  return (
    <span className={`shrink-0 rounded bg-tile p-1 ${className}`}>
      {src && <img src={src} alt="" className="h-full w-full object-contain" />}
    </span>
  );
}

function NumberInput({ label, ...props }) {
  return (
    <label className="block">
      <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-muted">{label}</span>
      <input
        type="number"
        min={0}
        {...props}
        className="mt-1 h-11 w-full rounded-md border-2 border-ink/10 bg-white px-3 font-display text-base font-medium text-ink transition-colors focus:border-accent-500 focus:outline-none"
      />
    </label>
  );
}

function hm(total) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

const PAYOUT_TONE = { PAID: 'bg-brand-50 text-brand-700', FAILED: 'bg-red-100 text-red-700' };

export default function VendorPortalPage() {
  const { products } = useLodgeMart();
  const [dash, setDash] = useState(null);
  const [newRow, setNewRow] = useState({ productId: '', price: '', stock: '' });
  const [newRowError, setNewRowError] = useState('');
  const [items, setItems] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savedId, setSavedId] = useState('');
  const [rowError, setRowError] = useState({});
  const [packing, setPacking] = useState('');
  const [priceFor, setPriceFor] = useState(null); // inventory row
  const [cutoffIn, setCutoffIn] = useState(() => secondsToNextCutoff());

  const load = useCallback(async () => {
    try {
      const [d, i, f] = await Promise.all([api('/vendor/dashboard'), api('/vendor/items'), api('/vendor/feedback')]);
      setDash(d);
      setItems(i.items);
      setFeedback(f.feedback);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30_000); // the batch appears at the cutoff
    const tick = setInterval(() => setCutoffIn(secondsToNextCutoff()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const pending = useMemo(() => items.filter((i) => !i.riderPickedUp), [items]);

  const bulkSummary = useMemo(() => {
    const map = new Map();
    for (const i of pending) {
      const row = map.get(i.product.id) || { product: i.product, qty: 0 };
      row.qty += i.qty;
      map.set(i.product.id, row);
    }
    return [...map.values()];
  }, [pending]);

  const bags = useMemo(() => {
    const map = new Map();
    for (const i of pending) {
      if (!map.has(i.order.id)) map.set(i.order.id, { order: i.order, items: [] });
      map.get(i.order.id).items.push(i);
    }
    return [...map.values()];
  }, [pending]);

  // Batches (date + slot) that hold each product, for the price-rise report.
  const batchesFor = (productId) => {
    const seen = new Map();
    for (const i of pending) {
      if (i.product.id !== productId) continue;
      const key = `${i.order.batchDate}|${i.order.batchSlot.id}`;
      if (!seen.has(key)) seen.set(key, { batchDate: i.order.batchDate, batchSlotId: i.order.batchSlot.id, label: i.order.batchSlot.label });
    }
    return [...seen.values()];
  };

  const togglePacked = async (item) => {
    setPacking(item.id);
    try {
      await api(`/vendor/items/${item.id}/packed`, { method: 'PATCH', body: { packed: !item.vendorPacked } });
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, vendorPacked: !item.vendorPacked } : x)));
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setPacking('');
    }
  };

  const saveRow = async (row) => {
    const draft = drafts[row.productId];
    if (!draft) return;
    const price = Number(draft.price);
    const stock = Number(draft.stock);
    if (!(price > 0) || !Number.isInteger(stock) || stock < 0) {
      setRowError((e) => ({ ...e, [row.productId]: 'Enter a price above ₦0 and a whole-number stock.' }));
      return;
    }
    try {
      await api(`/vendor/inventory/${row.productId}`, {
        method: 'PUT',
        body: { wholesalePriceKobo: Math.round(price * 100), stockQty: stock },
      });
      setRowError((e) => ({ ...e, [row.productId]: '' }));
      setDrafts((d) => {
        const next = { ...d };
        delete next[row.productId];
        return next;
      });
      setSavedId(row.productId);
      setTimeout(() => setSavedId(''), 1500);
      load();
    } catch (err) {
      setRowError((e) => ({ ...e, [row.productId]: err.details?.[0]?.message || err.message }));
    }
  };

  // Start selling a catalogue product this stall doesn't list yet.
  const addProduct = async (e) => {
    e.preventDefault();
    const price = Number(newRow.price);
    const stock = Number(newRow.stock);
    if (!newRow.productId || !(price > 0) || !Number.isInteger(stock) || stock < 0) {
      setNewRowError('Pick a product, a price above ₦0 and a whole-number stock.');
      return;
    }
    try {
      await api(`/vendor/inventory/${newRow.productId}`, { method: 'PUT', body: { wholesalePriceKobo: Math.round(price * 100), stockQty: stock } });
      setNewRow({ productId: '', price: '', stock: '' });
      setNewRowError('');
      load();
    } catch (err) {
      setNewRowError(err.details?.[0]?.message || err.message);
    }
  };

  if (!dash) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <p className="text-muted">{error || 'Loading your stall...'}</p>
      </div>
    );
  }

  const { vendor, stallPickups } = dash;

  return (
    <div className="min-h-screen bg-canvas pb-24 md:pb-16">
      <PageHeader kicker={`${vendor.name} · ${vendor.market} (${vendor.stallNumber})`} title="Stall portal">
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-white/60">Paid out to your bank</p>
            <p className="mt-1 font-display text-6xl sm:text-7xl font-semibold leading-none tabular-nums">{koboToNaira(vendor.payoutBalanceKobo)}</p>
            <p className="mt-2 text-sm text-white/60">
              {vendor.bankName} · {vendor.bankAccountNumber} · pending {koboToNaira(vendor.pendingPayoutKobo)}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="flex flex-wrap items-center gap-1.5 font-display text-lg text-white">
              <Star className="h-5 w-5 fill-accent-500 text-accent-500" /> {vendor.ratingScore.toFixed(2)}
              <span className="text-sm text-white/60">({vendor.ratingCount} ratings)</span>
              {vendor.priorityTier && (
                <span className="ml-2 rounded bg-accent-500 px-2 py-1 font-display text-[10px] uppercase tracking-[0.12em] text-ink">Priority supplier</span>
              )}
            </span>
            <span className="flex items-center gap-2 rounded-md bg-accent-500 px-4 py-3 font-display text-xs font-medium uppercase tracking-[0.12em] text-ink">
              <Wallet className="h-4 w-4" /> Paid when the rider collects · ₦0 withheld
            </span>
          </div>
        </div>
      </PageHeader>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 space-y-14">
        {error && <p role="alert" className="rounded-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {/* Batch rhythm: vendors only see a batch after the 3 PM cutoff */}
        <div className={`${card} flex flex-wrap items-center justify-between gap-4 p-5`}>
          <p className="flex items-center gap-3 text-ink">
            <Clock className="h-5 w-5 shrink-0 text-accent-600" />
            <span>
              <span className="font-display text-base font-medium uppercase">Next batch arrives at 3:00 PM</span>
              <span className="block text-sm text-muted">
                Orders appear here once students can no longer cancel. Pack by 4:00 PM; the rider collects and you're paid on pickup.
              </span>
            </span>
          </p>
          <span className="flex items-center gap-3">
            <span className="font-display text-2xl font-semibold tabular-nums text-ink">in {hm(cutoffIn)}</span>
            <button onClick={load} aria-label="Refresh" className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-ink/10 text-ink transition-colors hover:border-ink cursor-pointer">
              <RefreshCw className="h-4 w-4" />
            </button>
          </span>
        </div>

        {/* Bulk summary */}
        <PortalSection kicker="Total to measure" title="Bulk summary" icon={Package}>
          {bulkSummary.length === 0 ? (
            <p className={`${card} p-6 text-muted`}>Nothing to pack right now. Locked batches show up here after the 3:00 PM cutoff.</p>
          ) : (
            <Reveal stagger={0.08} className="grid gap-4 sm:grid-cols-3">
              {bulkSummary.map((b) => (
                <Reveal.Item key={b.product.id} className={`${card} flex items-center gap-4 p-4`}>
                  <Thumb productId={b.product.id} className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-medium uppercase leading-tight text-ink">{b.product.name}</p>
                    <p className="text-sm text-muted">{b.product.unit}</p>
                  </div>
                  <span className="font-display text-4xl font-semibold text-accent-600">{b.qty}×</span>
                </Reveal.Item>
              ))}
            </Reveal>
          )}
        </PortalSection>

        {/* Tagged bags */}
        <PortalSection kicker="Pack per student" title={`Tagged student bags (${bags.length})`} icon={ShoppingBag}>
          {bags.length === 0 ? (
            <p className={`${card} p-8 text-center text-muted`}>No bags to pack right now.</p>
          ) : (
            <Reveal stagger={0.1} className="grid gap-5 sm:grid-cols-2">
              {bags.map(({ order, items: bagItems }) => {
                const packed = bagItems.filter((i) => i.vendorPacked).length;
                return (
                  <Reveal.Item key={order.id} className={`${card} overflow-hidden`}>
                    <div className="flex items-center justify-between bg-ink px-5 py-4 text-white">
                      <div>
                        <p className="font-display text-2xl font-semibold uppercase">Tag {order.orderLabel}</p>
                        <p className="text-sm text-white/60">
                          {order.hub.name} · {prettyDate(order.batchDate)}
                          {order.requiresBagMerge && ' · merge bag'}
                        </p>
                      </div>
                      <span className="font-display text-sm uppercase tracking-[0.12em] text-accent-400">
                        {packed}/{bagItems.length} Packed
                      </span>
                    </div>
                    <div className="h-1.5 bg-ink/10">
                      <motion.div className="h-full bg-brand-700" animate={{ width: `${(packed / bagItems.length) * 100}%` }} transition={{ duration: 0.5, ease: OUT }} />
                    </div>
                    <div className="space-y-2.5 p-4">
                      {bagItems.map((item) => (
                        <button
                          key={item.id}
                          disabled={packing === item.id}
                          onClick={() => togglePacked(item)}
                          className={`flex w-full items-center gap-3 rounded-md border-2 p-3 text-left transition-colors duration-300 cursor-pointer disabled:opacity-60 ${
                            item.vendorPacked ? 'border-brand-700 bg-brand-50' : 'border-ink/10 hover:border-ink/30'
                          }`}
                        >
                          <Thumb productId={item.product.id} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink">{item.qty}× {item.product.name}</span>
                            <span className="block text-sm text-muted">You receive: {koboToNaira(item.wholesaleCostKobo * item.qty)}</span>
                          </span>
                          <span className={`flex items-center gap-2 font-display text-xs font-medium uppercase tracking-[0.12em] ${item.vendorPacked ? 'text-brand-700' : 'text-muted'}`}>
                            <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${item.vendorPacked ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink/20'}`}>
                              <AnimatePresence>
                                {item.vendorPacked && (
                                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                                    <Check className="h-4 w-4" />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </span>
                            {item.vendorPacked ? 'Packed' : 'Mark packed'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Reveal.Item>
                );
              })}
            </Reveal>
          )}
        </PortalSection>

        {/* Inventory */}
        <PortalSection kicker="Your wholesale price (₦) and stock for each product" title="My stall inventory & prices">
          <div className={`${card} overflow-hidden`}>
            {vendor.inventory.map((row) => {
              const draft = drafts[row.productId] || { price: toNaira(row.wholesalePriceKobo), stock: row.stockQty };
              const saved = savedId === row.productId;
              const set = (patch) => setDrafts((d) => ({ ...d, [row.productId]: { ...draft, ...patch } }));
              return (
                <div key={row.productId} className="border-b border-ink/10 px-5 py-4 last:border-0">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Thumb productId={row.productId} />
                      <div>
                        <p className="font-display text-base font-medium uppercase text-ink">{row.product.name}</p>
                        <p className="text-sm text-muted">{row.product.unit} · students pay {koboToNaira(row.product.studentPriceKobo)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2.5">
                      <div className="w-28">
                        <NumberInput label="Price (₦)" value={draft.price} onChange={(e) => set({ price: e.target.value })} />
                      </div>
                      <div className="w-24">
                        <NumberInput label="Stock qty" value={draft.stock} onChange={(e) => set({ stock: e.target.value })} />
                      </div>
                      <button
                        onClick={() => saveRow(row)}
                        className={`flex h-11 w-24 items-center justify-center gap-1.5 rounded-md font-display text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300 cursor-pointer active:scale-[0.97] ${
                          saved ? 'bg-brand-700 text-white' : 'bg-ink text-white hover:bg-accent-500 hover:text-ink'
                        }`}
                      >
                        {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                        {saved ? 'Saved' : 'Save'}
                      </button>
                      <button
                        onClick={() => setPriceFor(row)}
                        className="flex h-11 items-center justify-center gap-1.5 rounded-md border-2 border-ink/15 px-3 font-display text-xs font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:border-accent-500 cursor-pointer"
                      >
                        <TrendingUp className="h-4 w-4" /> Price went up
                      </button>
                    </div>
                  </div>
                  {rowError[row.productId] && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{rowError[row.productId]}</p>}
                </div>
              );
            })}
            {vendor.inventory.length === 0 && <p className="px-5 py-4 text-muted">You don't list any products yet. Add your first one below.</p>}
            {(() => {
              const listed = new Set(vendor.inventory.map((r) => r.productId));
              const choices = products.filter((p) => !listed.has(p.id));
              if (choices.length === 0) return null;
              return (
                <form onSubmit={addProduct} className="border-t-2 border-dashed border-ink/10 bg-canvas/60 px-5 py-4">
                  <div className="flex flex-wrap items-end gap-2.5">
                    <label className="block min-w-48 flex-1">
                      <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Add a product</span>
                      <select
                        value={newRow.productId}
                        onChange={(e) => setNewRow((r) => ({ ...r, productId: e.target.value }))}
                        className="mt-1 h-11 w-full rounded-md border-2 border-ink/10 bg-white px-3 text-ink focus:border-accent-500 focus:outline-none"
                      >
                        <option value="">Choose from the catalogue…</option>
                        {choices.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>
                    </label>
                    <div className="w-28">
                      <NumberInput label="Price (₦)" value={newRow.price} onChange={(e) => setNewRow((r) => ({ ...r, price: e.target.value }))} />
                    </div>
                    <div className="w-24">
                      <NumberInput label="Stock qty" value={newRow.stock} onChange={(e) => setNewRow((r) => ({ ...r, stock: e.target.value }))} />
                    </div>
                    <button type="submit" className="flex h-11 items-center gap-1.5 rounded-md bg-accent-500 px-4 font-display text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-white cursor-pointer">
                      <Plus className="h-4 w-4" /> Add
                    </button>
                  </div>
                  {newRowError && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{newRowError}</p>}
                </form>
              );
            })()}
          </div>
        </PortalSection>

        {/* Pickups & payouts */}
        <PortalSection kicker="Rider collections and bank transfers" title="Pickups & payouts" icon={Receipt}>
          {stallPickups.length === 0 ? (
            <p className={`${card} p-6 text-muted`}>No pickups yet.</p>
          ) : (
            <ul className={`${card} overflow-hidden`}>
              {stallPickups.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3 last:border-0">
                  <span className="text-sm text-ink">
                    <span className="font-semibold">{prettyDate(p.batchDate)}</span> · collected by {p.rider.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-display text-lg font-semibold tabular-nums text-ink">{koboToNaira(p.payoutKobo)}</span>
                    <span className={`rounded px-2 py-1 font-display text-[11px] uppercase tracking-[0.1em] ${PAYOUT_TONE[p.payoutStatus] || 'bg-accent-100 text-accent-700'}`}>
                      {p.payoutStatus}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PortalSection>

        {/* Feedback */}
        <PortalSection kicker="From student line-item ratings (anonymous)" title="Quality feedback" icon={MessageSquareWarning}>
          {feedback.length === 0 ? (
            <p className={`${card} p-6 text-muted`}>No ratings on your items yet.</p>
          ) : (
            <ul className={`${card} overflow-hidden`}>
              {feedback.slice(0, 20).map((f, idx) => (
                <li key={`${f.orderLabel}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3 last:border-0">
                  <span className="text-sm text-ink">
                    <span className="font-semibold">{f.qty}× {f.product.name}</span> · {f.orderLabel} · {prettyDate(f.batchDate)}
                  </span>
                  <span className="flex items-center gap-2">
                    {f.issueTag && <span className="rounded bg-red-100 px-2 py-1 font-display text-[11px] uppercase tracking-[0.08em] text-red-700">{f.issueTag}</span>}
                    {f.itemRating != null && (
                      <span className="flex items-center gap-1 font-display text-sm text-ink">
                        <Star className="h-4 w-4 fill-accent-500 text-accent-500" /> {f.itemRating}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PortalSection>
      </div>

      <PriceChangeModal
        open={Boolean(priceFor)}
        onClose={() => setPriceFor(null)}
        endpoint="/vendor/price-change"
        product={priceFor && { id: priceFor.productId, name: priceFor.product.name }}
        currentPrice={priceFor ? toNaira(priceFor.wholesalePriceKobo) : 0}
        batches={priceFor ? batchesFor(priceFor.productId) : []}
        onDone={load}
      />
    </div>
  );
}
