import React, { useState } from 'react';
import { X, Wallet, CreditCard, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';

export default function CheckoutModal({
  isOpen,
  onClose,
  totalAmount,
  batchSlot,
  onOrderSuccess,
}) {
  const { walletBalance, createOrder } = useLodgeMart();
  const [paymentMethod, setPaymentMethod] = useState('LodgeMart Wallet');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Complete Batch Checkout</h3>
            <p className="text-xs text-slate-500">{batchSlot}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total Payable</span>
            <span className="text-xl font-bold text-slate-900">
              ₦{totalAmount.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Select Payment Method
            </p>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                paymentMethod === 'LodgeMart Wallet'
                  ? 'border-emerald-700 bg-emerald-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === 'LodgeMart Wallet'}
                onChange={() => setPaymentMethod('LodgeMart Wallet')}
                className="mt-1 accent-emerald-700"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-700" />
                    LodgeMart Student Wallet
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    ₦{walletBalance.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instant 0.5s offline-safe confirmation
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                paymentMethod === 'Paystack Checkout'
                  ? 'border-emerald-700 bg-emerald-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === 'Paystack Checkout'}
                onChange={() => setPaymentMethod('Paystack Checkout')}
                className="mt-1 accent-emerald-700"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-slate-700" />
                    Paystack Checkout
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Test Mode
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Card, Bank Transfer, or USSD with verified reference
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleConfirmPayment}
            disabled={processing}
            className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing &amp; Routing Order...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Pay ₦{totalAmount.toLocaleString()} &amp; Place Batch Order</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Generates 4-digit Pickup PIN &amp; auto-routes to Eke Awka stalls</span>
          </div>
        </div>
      </div>
    </div>
  );
}
