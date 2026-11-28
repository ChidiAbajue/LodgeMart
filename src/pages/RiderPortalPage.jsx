import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, CheckCircle2, MapPin, Clock, KeyRound, AlertTriangle, Bike, Store, ChevronLeft, ChevronRight, Lock, Loader2 } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import { api, uploadStallPhoto } from '../lib/api';
import { clock, koboToNaira, lagosToday, prettyDate, statusLabel } from '../lib/adapters';
import { getProductImage } from '../data/productImages';
import CameraCaptureModal from '../components/CameraCaptureModal';
import PageHeader from '../components/ui/PageHeader';
import { ActionButton } from '../components/ui/Modal';

const SNAP = [0.7, 0, 0.2, 1];
const OUT = [0.16, 1, 0.3, 1];
const card = 'overflow-hidden rounded-lg bg-white shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)]';
const ON_THE_ROAD = ['RIDER_IN_TRANSIT', 'READY_AT_HUB', 'COLLECTED', 'LEFT_AT_KIOSK'];

function shiftDate(ymd, days) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + (days < 0 ? -1 : 1)); // no Sunday batch
  return d.toISOString().slice(0, 10);
}

function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function RiderPortalPage() {
  const { currentUser, slots } = useLodgeMart();
  const slotId = slots[0]?.id || 'evening';

  const [batchDate, setBatchDate] = useState(() => {
    const today = lagosToday();
    return new Date(`${today}T12:00:00Z`).getUTCDay() === 0 ? shiftDate(today, -1) : today;
  });
  const [manifest, setManifest] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('pickup');
  const [photos, setPhotos] = useState({}); // vendorId → dataUrl
  const [cameraVendor, setCameraVendor] = useState(null);
  const [busy, setBusy] = useState('');
  const [stallMsg, setStallMsg] = useState({});
  const [pinInputs, setPinInputs] = useState({});
  const [pinFeedback, setPinFeedback] = useState({});
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([
        api(`/rider/manifest?batchDate=${batchDate}&batchSlotId=${slotId}`),
        api('/rider/earnings'),
      ]);
      setManifest(m);
      setEarnings(e);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [batchDate, slotId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const confirmPickup = async (vendorId) => {
    const photo = photos[vendorId];
    if (!photo) return;
    setBusy(vendorId);
    setStallMsg((m) => ({ ...m, [vendorId]: '' }));
    try {
      const photoUrl = await uploadStallPhoto(photo);
      const res = await api('/rider/stall-pickups', { method: 'POST', body: { vendorId, batchDate, batchSlotId: slotId, photoUrl } });
      setPhotos((p) => {
        const next = { ...p };
        delete next[vendorId];
        return next;
      });
      setStallMsg((m) => ({ ...m, [vendorId]: `Collected ${res.itemsCollected} item(s). Payout ${koboToNaira(res.payoutKobo)} released.` }));
      load();
    } catch (err) {
      setStallMsg((m) => ({ ...m, [vendorId]: err.message }));
    } finally {
      setBusy('');
    }
  };

  const arrive = async (hubId) => {
    setBusy(hubId);
    try {
      await api('/rider/hub-arrivals', { method: 'POST', body: { hubId, batchDate, batchSlotId: slotId } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const submitPin = async (orderId) => {
    setBusy(orderId);
    try {
      const res = await api('/rider/handover', { method: 'POST', body: { orderId, pin: (pinInputs[orderId] || '').trim() } });
      setPinFeedback((f) => ({ ...f, [orderId]: { ok: true, msg: `Delivered to ${res.deliveredTo} (+${koboToNaira(res.earnedKobo)})` } }));
      load();
    } catch (err) {
      const left = err.details?.attemptsLeft;
      setPinFeedback((f) => ({ ...f, [orderId]: { ok: false, msg: left != null ? `${err.message} ${left} attempt(s) left.` : err.message } }));
    } finally {
      setBusy('');
    }
  };

  const kioskDrop = async (orderId) => {
    if (!window.confirm('Leave this bag at the partnered junction kiosk? The student collects it there with their PIN.')) return;
    setBusy(orderId);
    try {
      await api('/rider/kiosk-drop', { method: 'POST', body: { orderId } });
      setPinFeedback((f) => ({ ...f, [orderId]: { ok: true, msg: 'Left at the junction kiosk.' } }));
      load();
    } catch (err) {
      setPinFeedback((f) => ({ ...f, [orderId]: { ok: false, msg: err.message } }));
    } finally {
      setBusy('');
    }
  };

  const stalls = manifest?.stalls || [];
  const openStalls = stalls.filter((s) => !s.pickup);
  const pickupOpen = manifest?.batch.pickupOpen;
  const cutoff = clock(manifest?.batch.cutoffTime);

  const tabs = [
    { id: 'pickup', label: `Stall pickups (${openStalls.length})`, icon: Store },
    { id: 'handover', label: `Junction handover (${manifest?.hubs.length || 0})`, icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-24 md:pb-16">
      <PageHeader kicker="Eke Awka → UNIZIK junctions" title="Dispatch" image="/images/rider-band.webp">
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="flex items-center gap-3 font-display text-xl uppercase tracking-[0.06em]">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-500 text-ink">
              <Bike className="h-5 w-5" />
            </span>
            {currentUser?.name}
          </p>
          <div className="sm:text-right">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-white/60">Commission earned · {earnings?.deliveries ?? 0} handovers</p>
            <p className="font-display text-6xl font-semibold leading-none text-accent-400 tabular-nums">{koboToNaira(earnings?.totalKobo)}</p>
          </div>
        </div>
      </PageHeader>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 space-y-6">
        {/* Batch picker */}
        <div className={`${card} flex items-center justify-between gap-3 p-3`}>
          <button onClick={() => setBatchDate((d) => shiftDate(d, -1))} aria-label="Previous batch" className="flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-canvas cursor-pointer">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="font-display text-lg font-medium uppercase text-ink">{manifest?.batch.label || 'Evening Delivery'} · {prettyDate(batchDate)}</p>
            <p className="text-sm text-muted">
              {pickupOpen ? `Locked at ${cutoff}: stall pickups open` : `Orders still coming in. Pickups open at the ${cutoff || '3:00 PM'} cutoff`}
            </p>
          </div>
          <button onClick={() => setBatchDate((d) => shiftDate(d, 1))} aria-label="Next batch" className="flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-canvas cursor-pointer">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {error && <p role="alert" className="rounded-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

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
                className={`relative flex h-14 items-center justify-center gap-2 px-3 font-display text-xs sm:text-sm font-medium uppercase tracking-[0.1em] transition-colors cursor-pointer ${active ? 'text-white' : 'text-muted hover:text-ink'}`}
              >
                {active && <motion.span layoutId="phase-bg" className="absolute inset-0 bg-ink" transition={{ duration: 0.4, ease: SNAP }} />}
                <Icon className="relative hidden h-4 w-4 sm:block" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>

        {!manifest ? (
          <p className={`${card} p-10 text-center text-muted`}>Loading manifest...</p>
        ) : (
          <AnimatePresence mode="wait">
            {phase === 'pickup' ? (
              <motion.div key="pickup" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.35, ease: OUT }} className="space-y-5">
                {stalls.length === 0 && <p className={`${card} p-10 text-center text-muted`}>No orders in this batch.</p>}
                {stalls.map(({ vendor, items, pickup }, idx) => {
                  const photo = photos[vendor.id];
                  const merge = [...new Set(items.map((i) => i.orderLabel))].length;
                  const msg = stallMsg[vendor.id];
                  return (
                    <motion.article key={vendor.id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.06, duration: 0.5, ease: OUT } }} className={card}>
                      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                        <div className="flex items-start gap-4">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-500 font-display text-xl font-semibold text-ink">{idx + 1}</span>
                          <div>
                            <p className="font-display text-xs uppercase tracking-[0.2em] text-accent-700">Stop {idx + 1} · {vendor.stallNumber}</p>
                            <h3 className="font-display text-2xl font-semibold uppercase text-ink">{vendor.name}</h3>
                            <p className="text-sm text-muted">{items.length} item(s) · {merge} bag tag(s)</p>
                          </div>
                        </div>
                        {pickup && (
                          <span className="flex items-center gap-1.5 rounded bg-brand-50 px-2.5 py-1.5 font-display text-[11px] uppercase tracking-[0.1em] text-brand-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Collected {new Date(pickup.capturedAt).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <ul className="space-y-2 px-5">
                        {items.map((item, i) => (
                          <li key={`${item.orderLabel}-${i}`} className="flex items-center gap-3 rounded-md bg-canvas p-2.5">
                            <span className="h-10 w-10 shrink-0 rounded bg-tile p-1">
                              {getProductImage(item.product.id) && <img src={getProductImage(item.product.id)} alt="" className="h-full w-full object-contain" />}
                            </span>
                            <span className="flex-1 text-sm font-semibold text-ink">{item.orderLabel} · {item.qty}× {item.product.name}</span>
                            <span className={`pr-1 font-display text-xs uppercase tracking-[0.1em] ${item.riderPickedUp || item.vendorPacked ? 'text-brand-700' : 'text-accent-700'}`}>
                              {item.riderPickedUp ? 'On bike' : item.vendorPacked ? 'Packed' : 'Packing'}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {photo && (
                        <div className="mx-5 mt-4 flex items-center gap-3 rounded-md border-2 border-brand-700 bg-brand-50 p-2">
                          <img src={photo} alt="Stall proof" className="h-14 w-20 rounded object-cover" />
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-700"><CheckCircle2 className="h-4 w-4" /> Stall photo ready</span>
                        </div>
                      )}
                      {msg && <p role="status" className={`mx-5 mt-3 text-sm font-semibold ${msg.startsWith('Collected') ? 'text-brand-700' : 'text-red-600'}`}>{msg}</p>}

                      {!pickup && (
                        <div className="mt-5 grid gap-2.5 border-t border-ink/10 p-5 sm:grid-cols-2">
                          {pickupOpen ? (
                            <>
                              <button
                                onClick={() => setCameraVendor(vendor)}
                                className="flex h-14 items-center justify-center gap-2 rounded-md border-2 border-ink font-display text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-ink hover:text-white active:scale-[0.98] cursor-pointer"
                              >
                                <Camera className="h-4 w-4" /> {photo ? 'Retake stall photo' : 'Stall photo'}
                              </button>
                              <ActionButton disabled={!photo || busy === vendor.id} onClick={() => confirmPickup(vendor.id)} className="disabled:cursor-not-allowed disabled:opacity-40">
                                {busy === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                {busy === vendor.id ? 'Uploading...' : 'Confirm pickup & pay stall'}
                              </ActionButton>
                            </>
                          ) : (
                            <p className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
                              <Lock className="h-4 w-4 text-accent-700" /> Pickup opens at the {cutoff} cutoff, once students can no longer cancel.
                            </p>
                          )}
                        </div>
                      )}
                    </motion.article>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div key="handover" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: OUT }} className="space-y-5">
                {manifest.hubs.length === 0 && <p className={`${card} p-10 text-center text-muted`}>No orders in this batch.</p>}
                {manifest.hubs.map(({ hub, orders, arrivedAt, dwellEndsAt }, hi) => {
                  const onRoad = orders.filter((o) => ON_THE_ROAD.includes(o.status));
                  const atMarket = orders.length - onRoad.length;
                  const dwellLeft = dwellEndsAt ? new Date(dwellEndsAt).getTime() - now : null;
                  const dwellOver = dwellLeft != null && dwellLeft <= 0;
                  return (
                    <motion.article key={hub.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, transition: { delay: hi * 0.08, duration: 0.5, ease: OUT } }} className={card}>
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-4 text-white">
                        <h3 className="flex items-center gap-2.5 font-display text-2xl font-medium uppercase">
                          <MapPin className="h-5 w-5 text-accent-400" /> {hub.name}
                          <span className="text-base text-white/50">({orders.length} bags)</span>
                        </h3>
                        {!arrivedAt ? (
                          <button
                            disabled={onRoad.length === 0 || busy === hub.id}
                            onClick={() => arrive(hub.id)}
                            className="h-11 rounded-md bg-accent-500 px-5 font-display text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-white active:scale-[0.97] disabled:opacity-40 cursor-pointer"
                          >
                            Arrived at hub
                          </button>
                        ) : (
                          <span className={`flex h-11 items-center gap-2 rounded-md border-2 px-4 font-display text-sm uppercase tracking-[0.1em] tabular-nums ${dwellOver ? 'border-white/40 text-white/70' : 'border-accent-500 text-accent-400'}`}>
                            <Clock className="h-4 w-4" /> {dwellOver ? 'Dwell over: kiosk open' : `Dwell ${mmss(dwellLeft)}`}
                          </span>
                        )}
                      </div>

                      <div className="p-5">
                        {atMarket > 0 && <p className="mb-3 text-sm text-muted">{atMarket} bag(s) still at the market.</p>}
                        <ul className="space-y-3">
                          {onRoad.map((order) => {
                            const fb = pinFeedback[order.id];
                            const ready = order.status === 'READY_AT_HUB';
                            return (
                              <li key={order.id} className="rounded-md bg-canvas p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-display text-lg font-medium uppercase text-ink">
                                    {order.orderLabel} · {order.studentName}
                                    {order.delegateName && <span className="ml-2 text-sm text-accent-700">(Delegate: {order.delegateName})</span>}
                                    {order.requiresBagMerge && (
                                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-accent-700"><AlertTriangle className="h-3.5 w-3.5" /> merge bag</span>
                                    )}
                                  </p>
                                  <span className="rounded bg-ink px-2 py-1 font-display text-[11px] uppercase tracking-[0.1em] text-white">{statusLabel(order.status)}</span>
                                </div>

                                {ready && (
                                  <div className="mt-3 flex flex-wrap gap-2.5">
                                    <label className="relative flex min-w-40 flex-1 items-center">
                                      <span className="sr-only">4-digit PIN for {order.orderLabel}</span>
                                      <KeyRound className="pointer-events-none absolute left-4 h-4 w-4 text-muted" />
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={4}
                                        placeholder="4-digit PIN"
                                        value={pinInputs[order.id] || ''}
                                        onChange={(e) => setPinInputs((p) => ({ ...p, [order.id]: e.target.value.replace(/\D/g, '') }))}
                                        className="h-12 w-full rounded-md border-2 border-ink/10 bg-white pl-11 pr-3 font-display text-xl tracking-[0.4em] text-ink placeholder:text-sm placeholder:tracking-normal placeholder:text-muted/70 focus:border-accent-500 focus:outline-none"
                                      />
                                    </label>
                                    <button
                                      disabled={busy === order.id || (pinInputs[order.id] || '').length !== 4}
                                      onClick={() => submitPin(order.id)}
                                      className="h-12 rounded-md bg-ink px-5 font-display text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-accent-500 hover:text-ink disabled:opacity-40 active:scale-[0.97] cursor-pointer"
                                    >
                                      Verify PIN
                                    </button>
                                    <button
                                      disabled={!dwellOver || busy === order.id}
                                      onClick={() => kioskDrop(order.id)}
                                      title={dwellOver ? 'Leave at the partnered kiosk' : 'Available after the dwell timer'}
                                      className="flex h-12 items-center gap-1.5 rounded-md border-2 border-ink/15 px-4 font-display text-xs font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink disabled:opacity-40 cursor-pointer"
                                    >
                                      <Store className="h-4 w-4" /> Kiosk
                                    </button>
                                  </div>
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
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      <CameraCaptureModal
        isOpen={Boolean(cameraVendor)}
        onClose={() => setCameraVendor(null)}
        vendorName={cameraVendor?.name || ''}
        onCapture={(dataUrl) => cameraVendor && setPhotos((p) => ({ ...p, [cameraVendor.id]: dataUrl }))}
      />
    </div>
  );
}
