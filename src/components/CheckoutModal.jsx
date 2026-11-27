import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Wallet, CreditCard, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';

const SNAP = [0.7, 0, 0.2, 1];

function PayOption({ checked, onChange, icon: Icon, title, aside, note }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border-2 p-4 transition-colors ${
        checked ? 'border-accent-500 bg-accent-50' : 'border-ink/10 hover:border-ink/25'
      }`}
    >
      <input type="radio" name="paymentMethod" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-accent-600" />
      <span className="flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-display text-base font-medium uppercase text-ink">
            <Icon className="h-4 w-4 text-brand-700" /> {title}
          </span>
          {aside}
        </span>
        <span className="mt-1 block text-sm text-muted">{note}</span>
      </span>
    </label>
  );
}

export default function CheckoutModal({ isOpen, onClose, totalAmount, batchSlot, onOrderSuccess }) {
  const { walletBalance, createOrder } = useLodgeMart();
  const [paymentMethod, setPaymentMethod] = useState('LodgeMart Wallet');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleConfirmPayment = () => {
    if (processing) return;
    setError('');
    setProcessing(true);

    setTimeout(() => {
      const paymentRef =
        paymentMethod === 'Paystack Checkout'
          ? `PSK_TEST_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
          : `LM_WALLET_${Date.now().toString().slice(-6)}`;

      const res = createOrder({
        paymentMethod,
        paymentRef,
        batchSlot,
      });

      setProcessing(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      onOrderSuccess(res.order);
    }, 450);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" exit={{ opacity: 1 }}>
          <motion.div
            className="absolute inset-0 bg-ink/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            className="relative w-full overflow-hidden rounded-t-xl bg-white sm:max-w-md sm:rounded-xl"
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.4, ease: SNAP }}
          >
            <div className="flex items-start justify-between bg-ink px-6 py-5 text-white">
              <div>
                <h3 id="checkout-title" className="font-display text-2xl font-medium uppercase">Complete batch checkout</h3>
                <p className="mt-1 text-sm text-white/60">{batchSlot}</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Close checkout"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex items-baseline justify-between border-b-2 border-ink/10 pb-4">
                <span className="font-display text-sm uppercase tracking-[0.18em] text-muted">Total payable</span>
                <span className="font-display text-4xl font-semibold text-ink tabular-nums">₦{totalAmount.toLocaleString()}</span>
              </div>

              <fieldset className="space-y-2.5">
                <legend className="mb-2.5 font-display text-xs font-medium uppercase tracking-[0.2em] text-accent-700">
                  Select payment method
                </legend>
                <PayOption
                  checked={paymentMethod === 'LodgeMart Wallet'}
                  onChange={() => setPaymentMethod('LodgeMart Wallet')}
                  icon={Wallet}
                  title="LodgeMart Student Wallet"
                  aside={<span className="font-display text-sm font-medium text-brand-700 tabular-nums">₦{walletBalance.toLocaleString()}</span>}
                  note="Instant 0.5s offline-safe confirmation"
                />
                <PayOption
                  checked={paymentMethod === 'Paystack Checkout'}
                  onChange={() => setPaymentMethod('Paystack Checkout')}
                  icon={CreditCard}
                  title="Paystack Checkout"
                  aside={
                    <span className="rounded bg-accent-100 px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.12em] text-accent-700">
                      Test mode
                    </span>
                  }
                  note="Card, Bank Transfer, or USSD with verified reference"
                />
              </fieldset>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="rounded-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                >
                  {error}
                </motion.p>
              )}

              <button
                onClick={handleConfirmPayment}
                disabled={processing}
                className="group/btn relative isolate flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-md bg-accent-500 font-display text-sm font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:text-white disabled:opacity-60 cursor-pointer before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-ink before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.7,0,0.2,1)] hover:before:scale-x-100 active:scale-[0.98]"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing &amp; routing order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Pay ₦{totalAmount.toLocaleString()} &amp; place batch order</span>
                  </>
                )}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
                <ShieldCheck className="h-4 w-4 text-brand-700" />
                Generates 4-digit Pickup PIN &amp; auto-routes to Eke Awka stalls
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
