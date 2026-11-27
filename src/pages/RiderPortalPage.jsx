import React, { useState, useEffect } from 'react';
import {
  Camera,
  CheckCircle2,
  MapPin,
  Clock,
  KeyRound,
  AlertTriangle,
  Bike,
} from 'lucide-react';
import { ALL_HUBS } from '../data/seedData';
import { useLodgeMart } from '../context/LodgeMartContext';
import CameraCaptureModal from '../components/CameraCaptureModal';

export default function RiderPortalPage() {
  const {
    vendors,
    orders,
    orderItems,
    hubArrivals,
    riderEarnings,
    confirmStallPickup,
    markHubArrived,
    verifyHandoverPin,
    leaveAtKiosk,
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
      const items = orderItems.filter(
        (i) => i.assignedVendorId === vendor.id && !i.riderPickedUp
      );
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
      [orderId]: res.ok
        ? { ok: true, msg: `Delivered to ${res.recipient} (+₦150)` }
        : { ok: false, msg: res.error },
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

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-12">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Rider Header */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base">Tunde Bakare • Ifite Route</h1>
              <p className="text-xs text-slate-400">Eke Awka → UNIZIK Junctions</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-400 uppercase">Commission Earned</p>
            <p className="text-xl font-extrabold text-emerald-400">
              ₦{riderEarnings.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Phase Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-xl border border-slate-200">
          <button
            onClick={() => setPhase('pickup')}
            className={`py-2.5 rounded-lg text-xs font-bold cursor-pointer ${
              phase === 'pickup'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Phase 1: Stall Pickups ({vendorStops.length})
          </button>
          <button
            onClick={() => setPhase('handover')}
            className={`py-2.5 rounded-lg text-xs font-bold cursor-pointer ${
              phase === 'handover'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Phase 2: Junction Handover
          </button>
        </div>

        {/* Phase 1: Stall-by-Stall Market Pickups */}
        {phase === 'pickup' && (
          <div className="space-y-4">
            {vendorStops.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                All market stalls cleared! Switch to Phase 2 for Junction Handover.
              </div>
            ) : (
              vendorStops.map(({ vendor, items, payoutTotal, mergeOrders }, idx) => {
                const photo = capturedPhotos[vendor.id];
                return (
                  <div
                    key={vendor.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                          Stop {idx + 1} • {vendor.stallNumber}
                        </span>
                        <h3 className="font-bold text-slate-900 text-base">{vendor.name}</h3>
                        <p className="text-xs text-slate-500">
                          Instant Payout: ₦{payoutTotal.toLocaleString()}
                        </p>
                      </div>

                      {mergeOrders.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {mergeOrders.map((oid) => (
                            <span
                              key={oid}
                              className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Merge Bag ({oid})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {items.map((item) => (
                        <div
                          key={item.itemId}
                          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-slate-800">
                            {item.orderId} • {item.qty}× {item.productName}
                          </span>
                          <span
                            className={`font-semibold ${
                              item.vendorPacked ? 'text-emerald-700' : 'text-amber-600'
                            }`}
                          >
                            {item.vendorPacked ? 'Packed' : 'Pending Pack'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {photo && (
                      <div className="rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50 p-2 flex items-center gap-3">
                        <img
                          src={photo}
                          alt="Captured stall proof"
                          className="w-16 h-12 object-cover rounded-lg"
                        />
                        <span className="text-xs font-semibold text-emerald-800">
                          Live stall proof captured
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2.5">
                      <button
                        onClick={() => setCameraVendor(vendor)}
                        className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-emerald-700" />
                        <span>{photo ? 'Retake Stall Photo' : 'Take Stall Photo'}</span>
                      </button>

                      <button
                        disabled={!photo}
                        onClick={() => handleConfirmPickup(vendor.id)}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Pickup &amp; Release 100% Payout</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Phase 2: Junction Hub Handover */}
        {phase === 'handover' && (
          <div className="space-y-5">
            {ALL_HUBS.map((hub) => {
              const hubOrders = orders.filter(
                (o) =>
                  o.pickupHub === hub &&
                  (o.status === 'Rider In Transit' ||
                    o.status === 'Ready at Hub' ||
                    o.status === 'Collected')
              );
              const arrivedAt = hubArrivals[hub];

              return (
                <div
                  key={hub}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-700" />
                      <h3 className="font-bold text-slate-900 text-sm">{hub}</h3>
                      <span className="text-xs text-slate-500">
                        ({hubOrders.length} sacks)
                      </span>
                    </div>

                    {!arrivedAt ? (
                      <button
                        onClick={() => markHubArrived(hub)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Arrived at Pickup Hub
                      </button>
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Dwell Timer: {formatDwellTimer(arrivedAt)}</span>
                      </div>
                    )}
                  </div>

                  {hubOrders.length === 0 ? (
                    <p className="text-xs text-slate-400">No sacks in transit for this hub.</p>
                  ) : (
                    <div className="space-y-3">
                      {hubOrders.map((order) => {
                        const fb = pinFeedback[order.id];
                        return (
                          <div
                            key={order.id}
                            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <span className="font-bold text-slate-900 text-xs">
                                  {order.id} •{' '}
                                  {order.delegateInfo?.active
                                    ? `Handover to Delegate: ${order.delegateInfo.name} (for ${order.studentName})`
                                    : order.studentName}
                                </span>
                              </div>
                              <span className="text-[11px] font-semibold text-emerald-700">
                                {order.status}
                              </span>
                            </div>

                            {order.status !== 'Collected' &&
                            order.status !== 'Left at Junction Kiosk' ? (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                    <input
                                      type="text"
                                      maxLength={4}
                                      placeholder="Enter 4-digit PIN"
                                      value={pinInputs[order.id] || ''}
                                      onChange={(e) =>
                                        setPinInputs((prev) => ({
                                          ...prev,
                                          [order.id]: e.target.value,
                                        }))
                                      }
                                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold tracking-widest focus:outline-none focus:border-emerald-700"
                                    />
                                  </div>
                                  <button
                                    disabled={!arrivedAt}
                                    onClick={() => handlePinSubmit(order.id)}
                                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Verify PIN
                                  </button>
                                </div>
                                {arrivedAt && (
                                  <button
                                    onClick={() => leaveAtKiosk(order.id)}
                                    className="w-full py-1.5 px-3 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Leave at Partnered Junction Kiosk (Uncollected Fallback)
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs font-semibold text-emerald-700">
                                ✓ Handed over to {order.deliveredTo}
                              </p>
                            )}

                            {fb && (
                              <p
                                className={`text-[11px] font-semibold ${
                                  fb.ok ? 'text-emerald-700' : 'text-red-600'
                                }`}
                              >
                                {fb.msg}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
