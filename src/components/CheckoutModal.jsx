import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Wallet, Landmark, ShieldCheck, Loader2, CheckCircle2, Copy, KeyRound } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import VirtualAccountForm from './VirtualAccountForm';

const SNAP = [0.7, 0, 0.2, 1];

function PayOption({ checked, onChange, icon: Icon, title, aside, children }) {
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
        <span className="mt-1 block text-sm text-muted">{children}</span>
      </span>
    </label>
  );
}

function Countdown({ until }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  return (
    <span className="tabular-nums">
      {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}
    </span>
  );
}

function PinTiles({ pin }) {
  return (
    <div className="flex justify-center gap-2.5" aria-label={`PIN ${pin}`}>
      {pin.split('').map((d, i) => (
        <motion.span
          key={`${pin}-${i}`}
          aria-hidden="true"
          className="flex h-16 w-13 items-center justify-center rounded-md bg-ink font-display text-4xl font-semibold text-white"
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
          style={{ transformPerspective: 400 }}
        >
          {d}
        </motion.span>
      ))}
    </div>
  );
}

export default function CheckoutModal({ isOpen, onClose, totalAmount, batchSlot, onOrderSuccess }) {
  const { wallet, walletBalance, createOrder, verifyPayment } = useLodgeMart();
  const [method, setMethod] = useState('WALLET');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [transfer, setTransfer] = useState(null); // { order, payment }
  const [paidOrder, setPaidOrder] = useState(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTransfer(null);
      setPaidOrder(null);
      setError('');
      setShowAccountForm(false);
    }
  }, [isOpen]);

  const handleConfirmPayment = async () => {
    if (processing) return;
    setError('');
    setProcessing(true);
    const res = await createOrder(method);
    setProcessing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.payment) setTransfer({ order: res.order, payment: res.payment });
    else setPaidOrder(res.order);
  };

  const handleSentTransfer = async () => {
    setError('');
    setProcessing(true);
    const res = await verifyPayment(transfer.order.id);
    setProcessing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.order.statusCode === 'PENDING_PAYMENT') {
      setError("We haven't received the transfer yet. Transfers usually land within a minute — try again shortly.");
      return;
    }
    setPaidOrder(res.order);
  };

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(transfer.payment.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const close = () => {
    if (paidOrder) onOrderSuccess(paidOrder);
    else if (transfer) onOrderSuccess(transfer.order); // order exists, awaiting transfer
    else onClose();
  };

  const va = wallet?.virtualAccount;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" exit={{ opacity: 1 }}>
          <motion.div className="absolute inset-0 bg-ink/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            className="relative max-h-[94svh] w-full overflow-y-auto rounded-t-xl bg-white sm:max-w-md sm:rounded-xl"
            data-lenis-prevent
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.4, ease: SNAP }}
          >
            <div className="flex items-start justify-between bg-ink px-6 py-5 text-white">
              <div>
                <h3 id="checkout-title" className="font-display text-2xl font-medium uppercase">
                  {paidOrder ? 'Order placed' : transfer ? 'Transfer to pay' : 'Complete batch checkout'}
                </h3>
                <p className="mt-1 text-sm text-white/60">Monnify (by Moniepoint) · {batchSlot}</p>
              </div>
              <button onClick={close} className="flex h-10 w-10 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer" aria-label="Close checkout">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              {paidOrder ? (
                <div className="space-y-5 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-brand-700" />
                  <p className="font-display text-2xl font-semibold uppercase text-ink">Order {paidOrder.label} confirmed</p>
                  {paidOrder.pickupPin && (
                    <>
                      <p className="flex items-center justify-center gap-2 font-display text-xs uppercase tracking-[0.2em] text-accent-700">
                        <KeyRound className="h-4 w-4" /> Your junction pickup PIN
                      </p>
                      <PinTiles pin={paidOrder.pickupPin} />
                      <p className="text-sm text-muted">Show this PIN to the rider at {paidOrder.pickupHub}. Keep it private.</p>
                    </>
                  )}
                  <button onClick={close} className="h-12 w-full rounded-md bg-ink font-display text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-accent-500 hover:text-ink cursor-pointer">
                    View my orders
                  </button>
                </div>
              ) : transfer ? (
                <div className="space-y-5">
                  <p className="text-[0.95rem] text-muted">
                    Transfer <span className="font-semibold text-ink">exactly</span> this amount from any Nigerian bank app to this one-time account:
                  </p>
                  <div className="space-y-3 rounded-md border-2 border-ink/10 bg-canvas p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-xs uppercase tracking-[0.16em] text-muted">Amount</span>
                      <span className="font-display text-3xl font-semibold text-ink tabular-nums">₦{(transfer.payment.amountKobo / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="block font-display text-xs uppercase tracking-[0.16em] text-muted">Account number</span>
                        <span className="font-display text-2xl font-semibold tracking-[0.12em] text-ink tabular-nums">{transfer.payment.accountNumber}</span>
                      </div>
                      <button onClick={copyAccount} className="flex h-10 items-center gap-1.5 rounded-md border-2 border-ink px-3 font-display text-xs uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-white cursor-pointer">
                        <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-sm text-ink">
                      {transfer.payment.bankName} · {transfer.payment.accountName}
                    </p>
                    <p className="text-sm text-muted">
                      Account expires in <Countdown until={transfer.payment.expiresAt} /> · Order {transfer.order.label}
                    </p>
                  </div>
                  {error && <p role="alert" className="rounded-md border-2 border-accent-200 bg-accent-50 px-4 py-3 text-sm font-semibold text-ink">{error}</p>}
                  <button
                    onClick={handleSentTransfer}
                    disabled={processing}
                    className="relative isolate flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-md bg-accent-500 font-display text-sm font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:text-white disabled:opacity-60 cursor-pointer before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-ink before:transition-transform before:duration-300 hover:before:scale-x-100 active:scale-[0.98]"
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {processing ? 'Verifying with Monnify...' : 'I have sent the transfer'}
                  </button>
                  <p className="text-center text-xs text-muted">Your items are held for 30 minutes while you pay.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between border-b-2 border-ink/10 pb-4">
                    <span className="font-display text-sm uppercase tracking-[0.18em] text-muted">Total payable</span>
                    <span className="font-display text-4xl font-semibold text-ink tabular-nums">₦{totalAmount.toLocaleString()}</span>
                  </div>

                  <fieldset className="space-y-2.5">
                    <legend className="mb-2.5 font-display text-xs font-medium uppercase tracking-[0.2em] text-accent-700">Select payment method</legend>
                    <PayOption
                      checked={method === 'WALLET'}
                      onChange={() => setMethod('WALLET')}
                      icon={Wallet}
                      title="LodgeMart Wallet"
                      aside={<span className="font-display text-sm font-medium text-brand-700 tabular-nums">₦{walletBalance.toLocaleString()}</span>}
                    >
                      {va ? (
                        <span className="block font-semibold text-ink">
                          {va.accountNumber} — {va.bankName}
                        </span>
                      ) : (
                        <span className="block">Monnify virtual account</span>
                      )}
                      <span className="block text-xs">Funds held safely in your personal Moniepoint virtual bank account.</span>
                    </PayOption>
                    {!va && wallet?.fundingAvailable && (
                      <div className="pl-2">
                        {showAccountForm ? (
                          <VirtualAccountForm onDone={() => setShowAccountForm(false)} />
                        ) : (
                          <button onClick={() => setShowAccountForm(true)} className="text-sm font-semibold text-accent-700 underline-offset-4 hover:underline cursor-pointer">
                            Get my Moniepoint account number to top up
                          </button>
                        )}
                      </div>
                    )}
                    <PayOption checked={method === 'BANK_TRANSFER'} onChange={() => setMethod('BANK_TRANSFER')} icon={Landmark} title="Instant Bank Transfer" aside={<span className="rounded bg-accent-100 px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.12em] text-accent-700">Monnify</span>}>
                      Transfer to a one-time Moniepoint virtual account
                    </PayOption>
                  </fieldset>

                  {error && (
                    <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
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
                        <span>Routing order...</span>
                      </>
                    ) : method === 'WALLET' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Pay ₦{totalAmount.toLocaleString()} from wallet</span>
                      </>
                    ) : (
                      <>
                        <Landmark className="h-4 w-4" />
                        <span>Get transfer account</span>
                      </>
                    )}
                  </button>

                  <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
                    <ShieldCheck className="h-4 w-4 text-brand-700" />
                    Prices are checked on our server · 4-digit pickup PIN after payment
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
