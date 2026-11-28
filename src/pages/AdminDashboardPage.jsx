import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Star, RotateCcw, ShieldCheck, AlertTriangle, Split, Trophy } from 'lucide-react';
import { RIDER_COMMISSION } from '../data/seedData';
import { useLodgeMart } from '../context/LodgeMartContext';
import { getProductImage } from '../data/productImages';
import PageHeader from '../components/ui/PageHeader';
import PortalSection from '../components/ui/PortalSection';
import Reveal from '../components/ui/Reveal';

const OUT = [0.16, 1, 0.3, 1];

function StatTile({ label, value, highlight = false }) {
  return (
    <Reveal.Item
      className={`flex flex-col justify-between rounded-lg p-5 ${
        highlight ? 'bg-brand-700 text-white col-span-2 lg:col-span-1' : 'bg-white text-ink shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]'
      }`}
    >
      <p className={`font-display text-xs font-medium uppercase tracking-[0.16em] ${highlight ? 'text-white/70' : 'text-muted'}`}>{label}</p>
      <p className="mt-3 font-display text-3xl xl:text-4xl font-semibold leading-none tabular-nums">₦{value.toLocaleString()}</p>
    </Reveal.Item>
  );
}

export default function AdminDashboardPage() {
  const { orders, orderItems, vendors, resetSampleData } = useLodgeMart();
  const [expandedOrderId, setExpandedOrderId] = useState('#4082');

  // Unit Economics Calculations
  const totalGMV = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalDeliveryFees = orders.reduce((sum, o) => sum + o.deliveryFee, 0);
  const totalRetail = orderItems.reduce((sum, i) => sum + i.studentPrice * i.qty, 0);
  const totalWholesale = orderItems.reduce((sum, i) => sum + i.wholesaleCost * i.qty, 0);
  const grossMargin = totalRetail - totalWholesale + totalDeliveryFees;
  const vendorPayoutsSettled = vendors.reduce((sum, v) => sum + v.walletBalance, 0);
  const riderCommissions = orders.filter((o) => o.status === 'Collected').length * RIDER_COMMISSION;
  const netRetainedProfit = grossMargin - riderCommissions;

  const sections = [
    { href: '#overview', label: 'Live batch overview' },
    { href: '#inspector', label: 'Multi-vendor split inspector' },
    { href: '#leaderboard', label: 'Vendor quality leaderboard' },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader kicker="Ops & unit economics" title="Operations dashboard">
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
          <p className="max-w-2xl text-white/75">
            Monitor batch unit economics, inspect multi-vendor line-item splits, and oversee automated vendor quality
            routing (&lt; 3.5★ suspension).
          </p>
          <button
            onClick={resetSampleData}
            className="flex h-10 items-center gap-2 rounded-md border-2 border-white/60 px-4 font-display text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors duration-300 hover:bg-white hover:text-ink active:scale-[0.97] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" /> Reset sample data
          </button>
        </div>
      </PageHeader>

      {/* section jump bar */}
      <nav className="sticky top-16 z-30 bg-white shadow-[0_6px_20px_-14px_rgb(0_0_0/0.35)]" aria-label="Dashboard sections">
        <div className="max-w-6xl mx-auto flex gap-7 overflow-x-auto px-4 sm:px-6">
          {sections.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="group/nav relative shrink-0 py-4 font-display text-xs font-medium uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
            >
              {s.label}
              <span className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-accent-500 transition-transform duration-300 group-hover/nav:scale-x-100" />
            </a>
          ))}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 space-y-14">
        {/* Unit economics */}
        <section id="overview" className="scroll-mt-32">
          <Reveal stagger={0.07} className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTile label="Total GMV" value={totalGMV} />
            <StatTile label="Gross margin" value={grossMargin} />
            <StatTile label="Vendor payouts (100%)" value={vendorPayoutsSettled} />
            <StatTile label="Rider commissions" value={riderCommissions} />
            <StatTile label="Net retained profit (₦0 payroll)" value={netRetainedProfit} highlight />
          </Reveal>
        </section>

        {/* Split inspector */}
        <div id="inspector" className="scroll-mt-32">
          <PortalSection kicker="Line items per stall" title="Multi-vendor order split inspector" icon={Split}>
            <div className="overflow-hidden rounded-lg bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]">
              {orders.map((order) => {
                const items = orderItems.filter((i) => i.orderId === order.id);
                const isExpanded = expandedOrderId === order.id;
                return (
                  <div key={order.id} className="border-b border-ink/10 last:border-0">
                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-canvas cursor-pointer"
                    >
                      <span className="flex flex-wrap items-center gap-3">
                        <motion.span animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.25 }}>
                          <ChevronDown className="h-5 w-5 text-muted" />
                        </motion.span>
                        <span className="font-display text-xl font-medium uppercase text-ink">{order.id}</span>
                        <span className="text-sm text-muted">{order.studentName}</span>
                        {order.requiresBagMerge && (
                          <span className="rounded bg-accent-100 px-2 py-1 font-display text-[11px] uppercase tracking-[0.1em] text-accent-700">
                            Split-stall · merge bag
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-4">
                        <span className="rounded bg-ink px-2 py-1 font-display text-[11px] uppercase tracking-[0.1em] text-white">{order.status}</span>
                        <span className="font-display text-xl font-semibold text-ink tabular-nums">₦{order.totalAmount.toLocaleString()}</span>
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: OUT }}
                          className="overflow-hidden"
                        >
                          <ul className="space-y-2 px-5 pb-5 sm:pl-13">
                            {items.map((item) => {
                              const v = vendors.find((ven) => ven.id === item.assignedVendorId);
                              return (
                                <li key={item.itemId} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-canvas p-3">
                                  <span className="flex items-center gap-3">
                                    <span className="h-10 w-10 shrink-0 rounded bg-tile p-1">
                                      {getProductImage(item.productId) && <img src={getProductImage(item.productId)} alt="" className="h-full w-full object-contain" />}
                                    </span>
                                    <span>
                                      <span className="block text-sm font-semibold text-ink">
                                        {item.qty}× {item.productName}
                                      </span>
                                      <span className="block text-sm text-muted">
                                        → {v?.name} ({v?.stallNumber})
                                      </span>
                                    </span>
                                  </span>
                                  <span className="flex flex-wrap items-center gap-4 text-sm">
                                    <span className="text-muted">Wholesale: ₦{(item.wholesaleCost * item.qty).toLocaleString()}</span>
                                    <span className="font-semibold text-ink">Retail: ₦{(item.studentPrice * item.qty).toLocaleString()}</span>
                                    {item.issueTag && (
                                      <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-1 font-display text-[11px] uppercase tracking-[0.08em] text-red-700">
                                        <AlertTriangle className="h-3.5 w-3.5" /> {item.issueTag}
                                      </span>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
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

        {/* Leaderboard */}
        <div id="leaderboard" className="scroll-mt-32">
          <PortalSection kicker="Routing follows rating" title="Vendor quality & routing leaderboard" icon={Trophy}>
            <Reveal stagger={0.08} className="overflow-hidden rounded-lg bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]">
              {vendors.map((v, i) => {
                const isSuspended = v.ratingScore < 3.5;
                return (
                  <Reveal.Item key={v.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 px-5 py-4 last:border-0">
                    <div className="flex items-center gap-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tile font-display text-lg font-semibold text-ink">{i + 1}</span>
                      <div>
                        <p className="font-display text-xl font-medium uppercase text-ink">
                          {v.name} <span className="font-sans text-sm normal-case text-muted">({v.market} · {v.stallNumber})</span>
                        </p>
                        <p className="text-sm text-muted">Settled Today: ₦{v.walletBalance.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 font-display text-lg font-medium text-ink">
                        <Star className="h-5 w-5 fill-accent-500 text-accent-500" /> {v.ratingScore}
                        <span className="text-sm text-muted">({v.ratingCount})</span>
                      </span>
                      {isSuspended ? (
                        <span className="flex items-center gap-1.5 rounded bg-red-100 px-2.5 py-1.5 font-display text-[11px] uppercase tracking-[0.1em] text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Suspended (&lt; 3.5 stars)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 rounded bg-brand-50 px-2.5 py-1.5 font-display text-[11px] uppercase tracking-[0.1em] text-brand-700">
                          <ShieldCheck className="h-3.5 w-3.5" /> Routing active
                        </span>
                      )}
                    </div>
                  </Reveal.Item>
                );
              })}
            </Reveal>
          </PortalSection>
        </div>
      </div>
    </div>
  );
}
