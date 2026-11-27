import React, { useState } from 'react';
import {
  X,
  Wallet,
  Building2,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { VIRTUAL_ACCOUNT_INFO } from '../data/seedData';
import { useLodgeMart } from '../context/LodgeMartContext';

export default function CheckoutModal({
  isOpen,
  onClose,
  totalAmount,
  batchSlot,
  onOrderSuccess,
}) {
  const { walletBalance, createOrder } = useLodgeMart();
  const [paymentMethod, setPaymentMethod] = useState('LodgeMart Wallet (Monnify Virtual Account)');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isBankTransfer = paymentMethod === 'Instant Bank Transfer (Monnify Checkout)';
  const oneTimeAccount = '9045128734 — Moniepoint MFB';

  const handleConfirmPayment = () => {
    if (processing) return;
    setError('');
    setProcessing(true);

    setTimeout(() => {
      const paymentRef = isBankTransfer
        ? `MNFY_TX_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
        : `MNFY_WALLET_${Date.now().toString().slice(-6)}`;

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
    }, 900);
  };

  const handleCopyAccount = () => {
    navigator.clipboard?.writeText('9045128734');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Monnify (by Moniepoint) Checkout
            </h3>
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
                !isBankTransfer
                  ? 'border-emerald-700 bg-emerald-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                checked={!isBankTransfer}
                onChange={() =>
                  setPaymentMethod('LodgeMart Wallet (Monnify Virtual Account)')
                }
                className="mt-1 accent-emerald-700"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-700" />
                    LodgeMart Wallet
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    ₦{walletBalance.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-700 mt-0.5">
                  {VIRTUAL_ACCOUNT_INFO}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Funds held safely in your personal Moniepoint virtual bank account.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                isBankTransfer
                  ? 'border-emerald-700 bg-emerald-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                checked={isBankTransfer}
                onChange={() =>
                  setPaymentMethod('Instant Bank Transfer (Monnify Checkout)')
                }
                className="mt-1 accent-emerald-700"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-700" />
                    Instant Bank Transfer
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Monnify
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transfer to a one-time Moniepoint virtual account
                </p>
              </div>
            </label>
          </div>

          {isBankTransfer && (
            <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">One-Time Virtual Account</span>
                <button
                  type="button"
                  onClick={handleCopyAccount}
                  className="flex items-center gap-1 text-emerald-400 font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-sm font-extrabold tracking-wide">{oneTimeAccount}</p>
              <p className="text-[11px] text-slate-400">
                Send exact amount: <strong className="text-white">₦{totalAmount.toLocaleString()}</strong>
              </p>
            </div>
          )}

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
                <span>Verifying with Monnify...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isBankTransfer
                    ? 'I Have Sent the Transfer'
                    : `Pay ₦${totalAmount.toLocaleString()} & Place Order`}
                </span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Powered by Monnify (Moniepoint) • Generates 4-digit Pickup PIN</span>
          </div>
        </div>
      </div>
    </div>
  );
}
