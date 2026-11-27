import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { KeyRound, Users, Star, MapPin, CheckCircle2, ShoppingBasket, XCircle, Check } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import { getProductImage } from '../data/productImages';
import DelegatePinModal from '../components/DelegatePinModal';
import ItemRatingModal from '../components/ItemRatingModal';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Reveal from '../components/ui/Reveal';

const STATUS_STEPS = ['Order Placed', 'Packed at Market', 'Rider In Transit', 'Ready at Hub', 'Collected'];
const OUT = [0.16, 1, 0.3, 1];

function Timeline({ status }) {
  const current = STATUS_STEPS.indexOf(status);
  const pct = current <= 0 ? 0 : (current / (STATUS_STEPS.length - 1)) * 100;
  return (
    <div className="relative">
      <div className="absolute left-[10%] right-[10%] top-4 h-1 rounded-full bg-ink/10" />
      <motion.div
        className="absolute left-[10%] top-4 h-1 rounded-full bg-brand-700"
        initial={{ width: 0 }}
        whileInView={{ width: `${pct * 0.8}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: OUT, delay: 0.2 }}
      />
      <ol className="relative grid grid-cols-5">
        {STATUS_STEPS.map((step, idx) => {
          const done = idx < current || status === 'Collected';
          const now = idx === current && status !== 'Collected';
          return (
            <li key={step} className="flex flex-col items-center text-center">
              <span
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 font-display text-sm font-medium ${
                  done
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : now
                    ? 'border-accent-500 bg-accent-500 text-ink'
                    : 'border-ink/15 bg-white text-muted'
                }`}
              >
                {now && <span className="absolute inset-0 animate-ping rounded-full bg-accent-500/40" />}
                {done ? <Check className="h-4 w-4" /> : idx + 1}
              </span>
              <span
                className={`mt-2 font-display text-[10px] sm:text-xs font-medium uppercase leading-tight tracking-[0.06em] ${
                  done || now ? 'text-ink' : 'text-muted'
                }`}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DarkAction({ onClick, icon: Icon, children, tone = 'light' }) {
  const tones = {
    light: 'border-white/70 text-white hover:bg-white hover:text-ink',
    danger: 'border-red-300/70 text-red-200 hover:bg-red-500 hover:border-red-500 hover:text-white',
    accent: 'border-accent-500 bg-accent-500 text-ink hover:bg-white hover:border-white',
  };
  return (
    <button
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-md border-2 px-4 font-display text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300 active:scale-[0.97] cursor-pointer ${tones[tone]}`}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

export default function StudentOrdersPage() {
  const { currentUser, orders, orderItems, cancelOrder } = useLodgeMart();
  const [delegateOrder, setDelegateOrder] = useState(null);
  const [ratingOrder, setRatingOrder] = useState(null);
  const [cancelNotice, setCancelNotice] = useState('');

  const myOrders = orders.filter((o) => !currentUser?.email || o.studentEmail === currentUser.email);

  const handleCancel = (orderId) => {
    const res = cancelOrder(orderId);
    if (res.ok) {
      setCancelNotice(
        `Order ${orderId} cancelled. ₦${res.refundAmount.toLocaleString()} refunded to your wallet (₦${res.fee} cancellation fee).`
      );
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-24 md:pb-16">
      <PageHeader kicker="Live status · junction PINs" title="My batch orders">
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <p className="max-w-lg text-white/75">Live status, 4-digit junction PINs, and roommate delegation</p>
          <Button to="/shop" variant="outlineLight" size="sm">
            <ShoppingBasket className="h-4 w-4" /> New order
          </Button>
        </div>
      </PageHeader>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 space-y-6">
        <AnimatePresence>
          {cancelNotice && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md border-l-4 border-accent-500 bg-white px-5 py-4 text-sm font-semibold text-ink shadow-[0_6px_20px_-12px_rgb(0_0_0/0.3)]"
            >
              {cancelNotice}
            </motion.p>
          )}
        </AnimatePresence>

        {myOrders.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center">
            <ShoppingBasket className="mx-auto h-12 w-12 text-ink/20" />
            <p className="mt-4 font-display text-xl uppercase text-ink">No orders yet</p>
            <p className="mt-1 text-muted">Place your first batch order in the shop.</p>
          </div>
        ) : (
          myOrders.map((order) => {
            const items = orderItems.filter((i) => i.orderId === order.id);
            const open = order.status === 'Order Placed' || order.status === 'Packed at Market';
            const moving = order.status === 'Rider In Transit' || order.status === 'Ready at Hub';
            const cancelled = order.status === 'Cancelled';
            return (
              <Reveal key={order.id} as="article" className="overflow-hidden rounded-lg bg-white shadow-[0_10px_30px_-18px_rgb(0_0_0/0.35)]">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-display text-3xl font-semibold uppercase text-ink">Order {order.id}</h2>
                      <span
                        className={`rounded px-2.5 py-1 font-display text-[11px] font-medium uppercase tracking-[0.12em] ${
                          cancelled ? 'bg-red-100 text-red-700' : 'bg-accent-500 text-ink'
                        }`}
                      >
                        {order.status}
                      </span>
                      {order.delegateInfo?.active && (
                        <span className="rounded bg-brand-700 px-2.5 py-1 font-display text-[11px] font-medium uppercase tracking-[0.12em] text-white">
                          Delegated to {order.delegateInfo.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
                      {order.campusZone} · {order.pickupHub} · {order.batchSlot}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-3xl font-semibold text-ink tabular-nums">₦{order.totalAmount.toLocaleString()}</p>
                    <p className="text-sm text-muted">{order.paymentMethod}</p>
                  </div>
                </div>

                {/* Timeline */}
                {!cancelled && (
                  <div className="px-6 pt-7">
                    <Timeline status={order.status} />
                  </div>
                )}

                {/* PIN band */}
                <div className="mt-7 flex flex-wrap items-center justify-between gap-5 bg-ink px-6 py-5 text-white">
                  <div className="flex items-center gap-4">
                    <KeyRound className="h-6 w-6 text-accent-400" />
                    <div>
                      <p className="font-display text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
                        {order.delegateInfo?.active ? `Delegate PIN (${order.delegateInfo.name})` : 'Junction pickup PIN'}
                      </p>
                      <div className="mt-1.5 flex gap-1.5" aria-label={`PIN ${order.pickupPin}`}>
                        {order.pickupPin.split('').map((d, i) => (
                          <motion.span
                            key={`${order.pickupPin}-${i}`}
                            aria-hidden="true"
                            className="flex h-12 w-10 items-center justify-center rounded bg-white/10 font-display text-3xl font-semibold"
                            initial={{ rotateX: -90, opacity: 0 }}
                            whileInView={{ rotateX: 0, opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, ease: OUT, delay: 0.3 + i * 0.08 }}
                            style={{ transformPerspective: 400 }}
                          >
                            {d}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {open && (
                      <>
                        <DarkAction onClick={() => setDelegateOrder(order)} icon={Users}>Delegate pickup</DarkAction>
                        <DarkAction onClick={() => handleCancel(order.id)} icon={XCircle} tone="danger">Cancel (₦200 fee)</DarkAction>
                      </>
                    )}
                    {moving && <DarkAction onClick={() => setDelegateOrder(order)} icon={Users}>Delegate pickup</DarkAction>}
                    {order.status === 'Collected' && !order.rated && (
                      <DarkAction onClick={() => setRatingOrder(order)} icon={Star} tone="accent">Rate order</DarkAction>
                    )}
                    {order.rated && (
                      <span className="flex h-11 items-center gap-2 rounded-md bg-brand-700 px-4 font-display text-xs uppercase tracking-[0.14em]">
                        <CheckCircle2 className="h-4 w-4" /> Rated
                      </span>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="px-6 py-6">
                  <p className="font-display text-xs font-medium uppercase tracking-[0.2em] text-accent-700">
                    Basket items ({items.length})
                  </p>
                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    {items.map((item) => (
                      <li key={item.itemId} className="flex items-center gap-3 rounded-md bg-canvas p-2.5">
                        <span className="h-12 w-12 shrink-0 rounded bg-tile p-1">
                          {getProductImage(item.productId) && (
                            <img src={getProductImage(item.productId)} alt="" className="h-full w-full object-contain" />
                          )}
                        </span>
                        <span className="flex-1 text-sm font-semibold text-ink">
                          {item.qty}× {item.productName}
                        </span>
                        <span className="pr-1.5 font-display text-base font-medium text-ink tabular-nums">
                          ₦{(item.studentPrice * item.qty).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })
        )}
      </div>

      <DelegatePinModal isOpen={Boolean(delegateOrder)} onClose={() => setDelegateOrder(null)} order={delegateOrder} />

      <ItemRatingModal
        isOpen={Boolean(ratingOrder)}
        onClose={() => setRatingOrder(null)}
        order={ratingOrder}
        items={ratingOrder ? orderItems.filter((i) => i.orderId === ratingOrder.id) : []}
      />
    </div>
  );
}
