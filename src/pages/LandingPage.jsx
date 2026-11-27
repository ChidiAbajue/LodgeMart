import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  ShieldCheck,
  MapPin,
  TrendingDown,
  Sparkles,
} from 'lucide-react';

export default function LandingPage() {
  const [monthlySpend, setMonthlySpend] = useState(35000);
  const [secondsLeft, setSecondsLeft] = useState(42 * 60 + 15);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 45 * 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const estimatedMonthlySavings = Math.round(monthlySpend * 0.28);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-12">
      {/* Hero */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>UNIZIK Pilot • Ifite, Tempsite &amp; Aroma</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Eke Awka Market Prices,{' '}
              <span className="text-emerald-700">Delivered to Your Lodge Junction.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Stop losing study hours commuting to crowded markets or paying 25%–35% markups at
              campus kiosks. Join scheduled batch runs aligned with your lecture breaks for a
              flat ₦350 fee.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/shop"
                className="px-6 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center gap-2 transition-colors"
              >
                <span>Browse Unified Market</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="px-6 py-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-colors"
              >
                Portal Sign In
              </Link>
            </div>
          </div>

          {/* Live Batch Countdown & Savings Calculator */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-6">
            <div className="p-4 rounded-xl bg-emerald-700 text-white flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-100 uppercase tracking-wider">
                  Next Batch Cutoff (Midday Break)
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  Dynamo Junction • School Gate • Aroma
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 text-2xl font-extrabold tabular-nums">
                  <Clock className="w-5 h-5 text-emerald-200" />
                  <span>
                    00:{mins}:{secs}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-800">
                  Monthly Foodstuff Spend
                </label>
                <span className="text-sm font-bold text-slate-900">
                  ₦{monthlySpend.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={10000}
                max={100000}
                step={5000}
                value={monthlySpend}
                onChange={(e) => setMonthlySpend(Number(e.target.value))}
                className="w-full accent-emerald-700 cursor-pointer"
              />
              <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Estimated Monthly Savings</p>
                    <p className="text-xs font-medium text-slate-700">vs. Campus Lodge Kiosks</p>
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-emerald-700">
                  ₦{estimatedMonthlySavings.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="max-w-7xl mx-auto px-4 py-12 grid sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
          <MapPin className="w-6 h-6 text-emerald-700" />
          <h3 className="font-bold text-slate-900">Junction Batch Drops</h3>
          <p className="text-sm text-slate-600">
            Pick up at Dynamo Junction, School Gate, or Aroma Junction between lectures for a
            flat ₦350.
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
          <ShieldCheck className="w-6 h-6 text-emerald-700" />
          <h3 className="font-bold text-slate-900">4-Digit PIN &amp; Roommate Delegate</h3>
          <p className="text-sm text-slate-600">
            Stuck in a lab? Rotate your PIN and delegate pickup to your roommate via WhatsApp in
            one tap.
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
          <Clock className="w-6 h-6 text-emerald-700" />
          <h3 className="font-bold text-slate-900">100% Instant Vendor Payouts</h3>
          <p className="text-sm text-slate-600">
            Traders at Eke Awka get paid 100% on rider pickup with zero holdback—guaranteeing
            fresh stock.
          </p>
        </div>
      </section>
    </div>
  );
}
