import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Wallet, Check, Package, Save, ShoppingBag } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import { getProductImage } from '../data/productImages';
import PageHeader from '../components/ui/PageHeader';
import PortalSection from '../components/ui/PortalSection';
import Reveal from '../components/ui/Reveal';

const OUT = [0.16, 1, 0.3, 1];

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

export default function VendorPortalPage() {
  const { currentUser, vendors, products, orderItems, orders, toggleItemPacked, updateVendorInventory } = useLodgeMart();

  const vendor = vendors.find((v) => v.id === currentUser?.vendorId);
  const [drafts, setDrafts] = useState({});
  const [savedId, setSavedId] = useState('');

  if (!vendor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <p className="text-muted">Please sign in with a Vendor account to access your stall portal.</p>
      </div>
    );
  }

  const myItems = orderItems.filter((item) => item.assignedVendorId === vendor.id);
  const pendingItems = myItems.filter((item) => !item.riderPickedUp);

  // Bulk Summary grouped by productId
  const bulkMap = pendingItems.reduce((acc, item) => {
    if (!acc[item.productId]) {
      acc[item.productId] = { productId: item.productId, productName: item.productName, unit: item.unit, totalQty: 0 };
    }
    acc[item.productId].totalQty += item.qty;
    return acc;
  }, {});
  const bulkSummary = Object.values(bulkMap);

  // Tagged Student Bags grouped by orderId
  const bagsMap = pendingItems.reduce((acc, item) => {
    if (!acc[item.orderId]) {
      const orderObj = orders.find((o) => o.id === item.orderId);
      acc[item.orderId] = {
        orderId: item.orderId,
        hub: orderObj?.pickupHub || 'Junction',
        batchSlot: orderObj?.batchSlot || '',
        items: [],
      };
    }
    acc[item.orderId].items.push(item);
    return acc;
  }, {});
  const taggedBags = Object.values(bagsMap);

  return (
    <div className="min-h-screen bg-canvas pb-24 md:pb-16">
      <PageHeader kicker={`${vendor.name} · ${vendor.market} (${vendor.stallNumber})`} title="Stall portal">
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-white/60">Available / Paid Today</p>
            <p className="mt-1 font-display text-6xl sm:text-7xl font-semibold leading-none tabular-nums">
              ₦{vendor.walletBalance.toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-white/60">{vendor.bankAccount}</p>
          </div>
          <span className="flex items-center gap-2 rounded-md bg-accent-500 px-4 py-3 font-display text-xs font-medium uppercase tracking-[0.12em] text-ink">
            <Wallet className="h-4 w-4" /> 100% Instant Payout on Rider Pickup — ₦0 Withheld
          </span>
        </div>
      </PageHeader>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 space-y-14">
        {/* Bulk summary */}
        <PortalSection kicker="Total to measure" title="Bulk summary" icon={Package}>
          {bulkSummary.length === 0 ? (
            <p className="rounded-lg bg-white p-6 text-muted">All assigned items have been picked up.</p>
          ) : (
            <Reveal stagger={0.08} className="grid gap-4 sm:grid-cols-3">
              {bulkSummary.map((b) => (
                <Reveal.Item key={b.productId} className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]">
                  <Thumb productId={b.productId} className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-medium uppercase leading-tight text-ink">{b.productName}</p>
                    <p className="text-sm text-muted">{b.unit}</p>
                  </div>
                  <span className="font-display text-4xl font-semibold text-accent-600">{b.totalQty}×</span>
                </Reveal.Item>
              ))}
            </Reveal>
          )}
        </PortalSection>

        {/* Tagged bags */}
        <PortalSection kicker="Pack per student" title={`Tagged student bags (${taggedBags.length})`} icon={ShoppingBag}>
          {taggedBags.length === 0 ? (
            <p className="rounded-lg bg-white p-8 text-center text-muted">No pending bags to pack right now.</p>
          ) : (
            <Reveal stagger={0.1} className="grid gap-5 sm:grid-cols-2">
              {taggedBags.map((bag) => {
                const packed = bag.items.filter((i) => i.vendorPacked).length;
                return (
                  <Reveal.Item key={bag.orderId} className="overflow-hidden rounded-lg bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]">
                    <div className="flex items-center justify-between bg-ink px-5 py-4 text-white">
                      <div>
                        <p className="font-display text-2xl font-semibold uppercase">Tag {bag.orderId}</p>
                        <p className="text-sm text-white/60">{bag.hub}</p>
                      </div>
                      <span className="font-display text-sm uppercase tracking-[0.12em] text-accent-400">
                        {packed}/{bag.items.length} Packed
                      </span>
                    </div>
                    <div className="h-1.5 bg-ink/10">
                      <motion.div
                        className="h-full bg-brand-700"
                        animate={{ width: `${(packed / bag.items.length) * 100}%` }}
                        transition={{ duration: 0.5, ease: OUT }}
                      />
                    </div>
                    <div className="space-y-2.5 p-4">
                      {bag.items.map((item) => (
                        <button
                          key={item.itemId}
                          onClick={() => toggleItemPacked(item.itemId)}
                          className={`flex w-full items-center gap-3 rounded-md border-2 p-3 text-left transition-colors duration-300 cursor-pointer ${
                            item.vendorPacked ? 'border-brand-700 bg-brand-50' : 'border-ink/10 hover:border-ink/30'
                          }`}
                        >
                          <Thumb productId={item.productId} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink">
                              {item.qty}× {item.productName}
                            </span>
                            <span className="block text-sm text-muted">
                              Wholesale: ₦{(item.wholesaleCost * item.qty).toLocaleString()}
                            </span>
                          </span>
                          <span
                            className={`flex items-center gap-2 font-display text-xs font-medium uppercase tracking-[0.12em] ${
                              item.vendorPacked ? 'text-brand-700' : 'text-muted'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                                item.vendorPacked ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink/20'
                              }`}
                            >
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
        <PortalSection kicker="Update your wholesale price (₦) and available stock quantity for each product." title="My stall inventory & wholesale prices">
          <div className="overflow-hidden rounded-lg bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]">
            {Object.entries(vendor.inventory).map(([productId, inv]) => {
              const product = products.find((p) => p.id === productId);
              if (!product) return null;
              const draft = drafts[productId] || { wholesalePrice: inv.wholesalePrice, stockQty: inv.stockQty };
              const saved = savedId === productId;
              return (
                <div key={productId} className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 px-5 py-4 last:border-0">
                  <div className="flex items-center gap-3">
                    <Thumb productId={productId} />
                    <div>
                      <p className="font-display text-base font-medium uppercase text-ink">{product.name}</p>
                      <p className="text-sm text-muted">{product.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-2.5">
                    <div className="w-28">
                      <NumberInput
                        label="Price (₦)"
                        value={draft.wholesalePrice}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [productId]: { ...draft, wholesalePrice: e.target.value } }))}
                      />
                    </div>
                    <div className="w-24">
                      <NumberInput
                        label="Stock Qty"
                        value={draft.stockQty}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [productId]: { ...draft, stockQty: e.target.value } }))}
                      />
                    </div>
                    <button
                      onClick={() => {
                        updateVendorInventory(vendor.id, productId, draft.wholesalePrice, draft.stockQty);
                        setSavedId(productId);
                        setTimeout(() => setSavedId(''), 1500);
                      }}
                      className={`flex h-11 w-24 items-center justify-center gap-1.5 rounded-md font-display text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300 cursor-pointer active:scale-[0.97] ${
                        saved ? 'bg-brand-700 text-white' : 'bg-ink text-white hover:bg-accent-500 hover:text-ink'
                      }`}
                    >
                      {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                      {saved ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </PortalSection>
      </div>
    </div>
  );
}
