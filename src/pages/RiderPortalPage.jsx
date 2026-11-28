import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, CheckCircle2, MapPin, Clock, KeyRound, AlertTriangle, Bike, Store } from 'lucide-react';
import { ALL_HUBS } from '../data/seedData';
import { useLodgeMart } from '../context/LodgeMartContext';
import { getProductImage } from '../data/productImages';
import CameraCaptureModal from '../components/CameraCaptureModal';
import PageHeader from '../components/ui/PageHeader';
import { ActionButton } from '../components/ui/Modal';

const SNAP = [0.7, 0, 0.2, 1];
const OUT = [0.16, 1, 0.3, 1];

export default function RiderPortalPage() {
  const {
    currentUser,
    vendors,
    orders,
    orderItems,
    hubArrivals,
    riderEarnings,
    confirmStallPickup,
    markHubArrived,
    verifyHandoverPin,
  } = useLodgeMart();

  const [phase, setPhase] = useState('pickup');
  const [capturedPhotos, setCapturedPhotos] = useState({});
  const [cameraVendor, setCameraVendor] = useState(null);
  const [pinInputs, setPinInputs] = useState({});
  const [pinFeedback, setPinFeedback] = useState({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Group pending market pickups by vendor
  const vendorStops = vendors
    .map((vendor) => {
      const items = orderItems.filter((i) => i.assignedVendorId === vendor.id && !i.riderPickedUp);
      if (items.length === 0) return null;
      const payoutTotal = items.reduce((s, i) => s + i.wholesaleCost * i.qty, 0);
      const mergeOrders = [
        ...new Set(
          items
            .map((i) => orders.find((o) => o.id === i.orderId))
            .filter((o) => o?.requiresBagMerge)
            .map((o) => o.id)
        ),
      ];
      return { vendor, items, payoutTotal, mergeOrders };
    })
    .filter(Boolean);

  const handlePhotoCaptured = (photoDataUrl) => {
    if (!cameraVendor) return;
    setCapturedPhotos((prev) => ({ ...prev, [cameraVendor.id]: photoDataUrl }));
  };

  const handleConfirmPickup = (vendorId) => {
    const photo = capturedPhotos[vendorId];
    if (!photo) return;
    confirmStallPickup(vendorId, 'Active Batch', photo);
    setCapturedPhotos((prev) => {
      const next = { ...prev };
      delete next[vendorId];
      return next;
    });
  };

  const handlePinSubmit = (orderId) => {
    const code = pinInputs[orderId] || '';
    const res = verifyHandoverPin(orderId, code);
    setPinFeedback((prev) => ({
      ...prev,
      [orderId]: res.ok ? { ok: true, msg: `Delivered to ${res.recipient} (+₦150)` } : { ok: false, msg: res.error },
    }));
  };

  const formatDwellTimer = (arrivedAt) => {
    if (!arrivedAt) return '20:00';
    const elapsed = Math.floor((now - arrivedAt) / 1000);
    const remaining = Math.max(0, 20 * 60 - elapsed);
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const tabs = [
    { id: 'pickup', label: `Phase 1: Stall pickups (${vendorStops.length})`, icon: Store },
    { id: 'handover', label: 'Phase 2: Junction handover', icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-24 md:pb-16">
      <PageHeader kicker="Eke Awka → UNIZIK Junctions" title="Dispatch" image="/images/rider-band.webp">
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="flex items-center gap-3 font-display text-xl uppercase tracking-[0.06em]">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-500 text-ink">
              <Bike className="h-5 w-5" />
            </span>
            {currentUser?.name || 'Tunde Bakare'} · Ifite Route
          </p>
          <div className="text-right">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-white/60">Commission earned</p>
            <p className="font-display text-6xl font-semibold leading-none text-accent-400 tabular-nums">
              ₦{riderEarnings.toLocaleString()}
            </p>
          </div>
        </div>
      </PageHeader>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 space-y-8">
        {/* Phase switcher */}
        <div className="grid grid-cols-2 overflow-hidden rounded-md bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = phase === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setPhase(id)}
                className={`relative flex h-14 items-center justify-center gap-2 px-3 font-display text-xs sm:text-sm font-medium uppercase tracking-[0.1em] transition-colors cursor-pointer ${
                  active ? 'text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {active && <motion.span layoutId="phase-bg" className="absolute inset-0 bg-ink" transition={{ duration: 0.4, ease: SNAP }} />}
                <Icon className="relative hidden h-4 w-4 sm:block" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {phase === 'pickup' ? (
            <motion.div
              key="pickup"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.35, ease: OUT }}
              className="space-y-5"
            >
              {vendorStops.length === 0 ? (
                <p className="rounded-lg bg-white p-10 text-center text-muted">
                  All market stalls cleared! Switch to Phase 2 for Junction Handover.
                </p>
              ) : (
                vendorStops.map(({ vendor, items, payoutTotal, mergeOrders }, idx) => {
                  const photo = capturedPhotos[vendor.id];
                  return (
                    <motion.article
                      key={vendor.id}
                      layout
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.08, duration: 0.5, ease: OUT } }}
                      exit={{ opacity: 0, x: 80 }}
                      className="overflow-hidden rounded-lg bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                        <div className="flex items-start gap-4">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-500 font-display text-xl font-semibold text-ink">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-display text-xs uppercase tracking-[0.2em] text-accent-700">
                              Stop {idx + 1} · {vendor.stallNumber}
                            </p>
                            <h3 className="font-display text-2xl font-semibold uppercase text-ink">{vendor.name}</h3>
                            <p className="text-sm text-muted">Instant Payout: ₦{payoutTotal.toLocaleString()}</p>
                          </div>
                        </div>
                        {mergeOrders.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {mergeOrders.map((oid) => (
                              <span key={oid} className="flex items-center gap-1.5 rounded bg-accent-100 px-2.5 py-1.5 font-display text-[11px] uppercase tracking-[0.1em] text-accent-700">
                                <AlertTriangle className="h-3.5 w-3.5" /> Merge bag ({oid})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <ul className="space-y-2 px-5">
                        {items.map((item) => (
                          <li key={item.itemId} className="flex items-center gap-3 rounded-md bg-canvas p-2.5">
                            <span className="h-10 w-10 shrink-0 rounded bg-tile p-1">
                              {getProductImage(item.productId) && <img src={getProductImage(item.productId)} alt="" className="h-full w-full object-contain" />}
                            </span>
                            <span className="flex-1 text-sm font-semibold text-ink">
                              {item.orderId} · {item.qty}× {item.productName}
                            </span>
                            <span className={`pr-1 font-display text-xs uppercase tracking-[0.1em] ${item.vendorPacked ? 'text-brand-700' : 'text-accent-700'}`}>
                              {item.vendorPacked ? 'Packed' : 'Pending pack'}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <AnimatePresence>
                        {photo && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mx-5 mt-4 flex items-center gap-3 overflow-hidden rounded-md border-2 border-brand-700 bg-brand-50 p-2"
                          >
                            <img src={photo} alt="Captured stall proof" className="h-14 w-20 rounded object-cover" />
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                              <CheckCircle2 className="h-4 w-4" /> Live stall proof captured
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="mt-5 grid gap-2.5 border-t border-ink/10 p-5 sm:grid-cols-2">
                        <button
                          onClick={() => setCameraVendor(vendor)}
                          className="flex h-14 items-center justify-center gap-2 rounded-md border-2 border-ink font-display text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-ink hover:text-white active:scale-[0.98] cursor-pointer"
                        >
                          <Camera className="h-4 w-4" /> {photo ? 'Retake stall proof' : 'Capture stall proof'}
                        </button>
                        <ActionButton disabled={!photo} onClick={() => handleConfirmPickup(vendor.id)} className="disabled:cursor-not-allowed disabled:opacity-40">
                          <CheckCircle2 className="h-4 w-4" /> Confirm pickup &amp; release payout
                        </ActionButton>
                      </div>
                    </motion.article>
                  );
                })
              )}
            </motion.div>
          ) : (
            <motion.div
              key="handover"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: OUT }}
              className="space-y-5"
            >
              {ALL_HUBS.map((hub, hi) => {
                const hubOrders = orders.filter(
                  (o) => o.pickupHub === hub && (o.status === 'Rider In Transit' || o.status === 'Ready at Hub' || o.status === 'Collected')
                );
                const arrivedAt = hubArrivals[hub];
                return (
                  <motion.article
                    key={hub}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: hi * 0.08, duration: 0.5, ease: OUT } }}
                    className="overflow-hidden rounded-lg bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-4 text-white">
                      <h3 className="flex items-center gap-2.5 font-display text-2xl font-medium uppercase">
                        <MapPin className="h-5 w-5 text-accent-400" /> {hub}
                        <span className="text-base text-white/50">({hubOrders.length} sacks)</span>
                      </h3>
                      {!arrivedAt ? (
                        <button
                          onClick={() => markHubArrived(hub)}
                          className="h-11 rounded-md bg-accent-500 px-5 font-display text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-white active:scale-[0.97] cursor-pointer"
                        >
                          Arrived at hub
                        </button>
                      ) : (
                        <span className="flex h-11 items-center gap-2 rounded-md border-2 border-accent-500 px-4 font-display text-sm uppercase tracking-[0.1em] text-accent-400 tabular-nums">
                          <Clock className="h-4 w-4" /> Dwell timer: {formatDwellTimer(arrivedAt)}
                        </span>
                      )}
                    </div>

                    <div className="p-5">
                      {hubOrders.length === 0 ? (
                        <p className="text-muted">No sacks in transit for this hub.</p>
                      ) : (
                        <ul className="space-y-3">
                          {hubOrders.map((order) => {
                            const fb = pinFeedback[order.id];
                            return (
                              <li key={order.id} className="rounded-md bg-canvas p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-display text-lg font-medium uppercase text-ink">
                                    {order.id} · {order.studentName}
                                    {order.delegateInfo?.active && (
                                      <span className="ml-2 text-sm text-accent-700">(Delegate: {order.delegateInfo.name})</span>
                                    )}
                                  </p>
                                  <span className="rounded bg-ink px-2 py-1 font-display text-[11px] uppercase tracking-[0.1em] text-white">{order.status}</span>
                                </div>

                                {order.status !== 'Collected' ? (
                                  <div className="mt-3 flex gap-2.5">
                                    <label className="relative flex flex-1 items-center">
                                      <span className="sr-only">4-digit PIN for {order.id}</span>
                                      <KeyRound className="pointer-events-none absolute left-4 h-4 w-4 text-muted" />
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={4}
                                        placeholder="Enter 4-digit PIN"
                                        value={pinInputs[order.id] || ''}
                                        onChange={(e) => setPinInputs((prev) => ({ ...prev, [order.id]: e.target.value }))}
                                        className="h-12 w-full rounded-md border-2 border-ink/10 bg-white pl-11 pr-3 font-display text-xl tracking-[0.4em] text-ink placeholder:text-sm placeholder:tracking-normal placeholder:text-muted/70 focus:border-accent-500 focus:outline-none"
                                      />
                                    </label>
                                    <button
                                      disabled={!arrivedAt}
                                      onClick={() => handlePinSubmit(order.id)}
                                      className="h-12 rounded-md bg-ink px-5 font-display text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-accent-500 hover:text-ink disabled:opacity-40 disabled:hover:bg-ink disabled:hover:text-white active:scale-[0.97] cursor-pointer"
                                    >
                                      Verify PIN
                                    </button>
                                  </div>
                                ) : (
                                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                                    <CheckCircle2 className="h-4 w-4" /> Handed over to {order.deliveredTo}
                                  </p>
                                )}

                                <AnimatePresence>
                                  {fb && (
                                    <motion.p
                                      key={fb.msg}
                                      initial={{ opacity: 0, y: -6 }}
                                      animate={fb.ok ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, x: [0, -6, 6, -3, 0] }}
                                      className={`mt-2 text-sm font-semibold ${fb.ok ? 'text-brand-700' : 'text-red-600'}`}
                                    >
                                      {fb.msg}
                                    </motion.p>
                                  )}
                                </AnimatePresence>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CameraCaptureModal
        isOpen={Boolean(cameraVendor)}
        onClose={() => setCameraVendor(null)}
        vendorName={cameraVendor?.name || ''}
        onCapture={handlePhotoCaptured}
      />
    </div>
  );
}
