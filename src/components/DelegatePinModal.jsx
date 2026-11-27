import React, { useState } from 'react';
import { X, Users, MessageCircle, KeyRound } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';

export default function DelegatePinModal({ isOpen, onClose, order }) {
  const { delegateOrderPin } = useLodgeMart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [generatedPin, setGeneratedPin] = useState('');

  if (!isOpen || !order) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    const newPin = delegateOrderPin(order.id, name, phone);
    setGeneratedPin(newPin);
  };

  const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^0/, '234');
  const waText = encodeURIComponent(
    `Hey ${name}, I delegated my LodgeMart order ${order.id} (${order.pickupHub}) to you. Your 4-digit Pickup PIN is ${generatedPin}. Show it to the rider at the junction!`
  );
  const waUrl = `https://wa.me/${cleanPhone}?text=${waText}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-base">Delegate Pickup PIN</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {!generatedPin ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-600">
                Stuck in a lecture? Assign a roommate to collect order{' '}
                <span className="font-semibold text-slate-900">{order.id}</span>. Your current
                PIN will be invalidated immediately.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Roommate Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Emeka"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 08012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-700"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm cursor-pointer"
              >
                Rotate PIN &amp; Delegate to Roommate
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Delegated to {name}
                </p>
                <p className="text-3xl font-extrabold tracking-[0.25em] text-slate-900 mt-2">
                  {generatedPin}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Previous PIN has been invalidated.
                </p>
              </div>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Share PIN via WhatsApp</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
