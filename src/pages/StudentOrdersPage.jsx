import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Users,
  Star,
  MapPin,
  CheckCircle2,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import DelegatePinModal from '../components/DelegatePinModal';
import ItemRatingModal from '../components/ItemRatingModal';

const STATUS_STEPS = [
  'Order Placed',
  'Packed at Market',
  'Rider In Transit',
  'Ready at Hub',
  'Collected',
];

export default function StudentOrdersPage() {
  const { currentUser, orders, orderItems, cancelOrder } = useLodgeMart();
  const [delegateOrder, setDelegateOrder] = useState(null);
  const [ratingOrder, setRatingOrder] = useState(null);
  const [cancelNotice, setCancelNotice] = useState('');

  const myOrders = orders.filter(
    (o) => !currentUser?.email || o.studentEmail === currentUser.email
  );

  const handleCancel = (orderId) => {
    const res = cancelOrder(orderId);
    if (res.ok) {
      setCancelNotice(
        `Order ${orderId} cancelled. ₦${res.refundAmount.toLocaleString()} refunded to your wallet (₦${res.fee} cancellation fee).`
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-12">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Batch Orders</h1>
            <p className="text-xs text-slate-500">
              Live status, 4-digit junction PINs, and roommate delegation
            </p>
          </div>
          <Link
            to="/shop"
            className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>New Order</span>
          </Link>
        </div>

        {cancelNotice && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">
            {cancelNotice}
          </div>
        )}

        {myOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">No orders yet</p>
            <p className="text-xs text-slate-500">Place your first batch order in the shop.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {myOrders.map((order) => {
              const items = orderItems.filter((i) => i.orderId === order.id);
              const currentStepIdx = STATUS_STEPS.indexOf(order.status);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5"
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-base">
                          Order {order.id}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {order.status}
                        </span>
                        {order.delegateInfo?.active && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Delegated to {order.delegateInfo.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          {order.campusZone} • {order.pickupHub} • {order.batchSlot}
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        ₦{order.totalAmount.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-400">{order.paymentMethod}</p>
                    </div>
                  </div>

                  {/* Step-by-Step Timeline */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {STATUS_STEPS.map((step, idx) => {
                      const completed = idx <= currentStepIdx;
                      return (
                        <div key={step} className="space-y-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              completed ? 'bg-emerald-700' : 'bg-slate-200'
                            }`}
                          />
                          <p
                            className={`text-[10px] leading-tight font-medium ${
                              completed ? 'text-emerald-800' : 'text-slate-400'
                            }`}
                          >
                            {step}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* High-Contrast 4-Digit PIN Box + Actions */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-700 flex items-center justify-center">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">
                          {order.delegateInfo?.active
                            ? `Delegate PIN (${order.delegateInfo.name})`
                            : 'Junction Pickup PIN'}
                        </p>
                        <p className="text-2xl font-extrabold tracking-[0.25em]">
                          {order.pickupPin}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(order.status === 'Order Placed' ||
                        order.status === 'Packed at Market') && (
                        <>
                          <button
                            onClick={() => setDelegateOrder(order)}
                            className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Delegate Pickup</span>
                          </button>
                          <button
                            onClick={() => handleCancel(order.id)}
                            className="px-3.5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel (₦200 fee)</span>
                          </button>
                        </>
                      )}

                      {(order.status === 'Rider In Transit' ||
                        order.status === 'Ready at Hub') && (
                        <button
                          onClick={() => setDelegateOrder(order)}
                          className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Delegate Pickup</span>
                        </button>
                      )}

                      {order.status === 'Collected' && !order.rated && (
                        <button
                          onClick={() => setRatingOrder(order)}
                          className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Rate Order</span>
                        </button>
                      )}

                      {order.rated && (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-800 text-emerald-100 text-xs font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Rated</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="border-t border-slate-100 pt-3 space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Basket Items ({items.length})
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {items.map((item) => (
                        <div
                          key={item.itemId}
                          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-slate-800">
                            {item.qty}× {item.productName}
                          </span>
                          <span className="font-semibold text-slate-900">
                            ₦{(item.studentPrice * item.qty).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DelegatePinModal
        isOpen={Boolean(delegateOrder)}
        onClose={() => setDelegateOrder(null)}
        order={delegateOrder}
      />

      <ItemRatingModal
        isOpen={Boolean(ratingOrder)}
        onClose={() => setRatingOrder(null)}
        order={ratingOrder}
        items={
          ratingOrder ? orderItems.filter((i) => i.orderId === ratingOrder.id) : []
        }
      />
    </div>
  );
}
