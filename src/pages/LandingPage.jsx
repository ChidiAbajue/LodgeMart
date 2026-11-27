import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, ShieldCheck, MapPin, TrendingDown } from 'lucide-react';
import { BATCH_SLOTS } from '../data/seedData';

function getNextCutoffSeconds() {
  const now = new Date();
  const cutoffs = [
    { h: 6, m: 45, label: 'Early Bird' },
    { h: 12, m: 15, label: 'Midday Break' },
    { h: 16, m: 45, label: 'Evening Hostel' },
  ];
  for (const c of cutoffs) {
    const target = new Date(now);
    target.setHours(c.h, c.m, 0, 0);
    if (target > now) {
      return {
        seconds: Math.floor((target - now) / 1000),
        label: c.label,
      };
    }
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 45, 0, 0);
  return {
    seconds: Math.floor((tomorrow - now) / 1000),
    label: 'Early Bird (Tomorrow)',
  };
}

export default function LandingPage() {
  const [monthlySpend, setMonthlySpend] = useState(35000);
  const [cutoff, setCutoff] = useState(getNextCutoffSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setCutoff(getNextCutoffSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hrs = String(Math.floor(cutoff.seconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((cutoff.seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(cutoff.seconds % 60).padStart(2, '0');
  const estimatedMonthlySavings = Math.round(monthlySpend * 0.28);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-12">
      {/* Hero */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7 space-y-6">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              UNIZIK Pilot • Ifite, Tempsite &amp; Aroma
            </p>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
              Eke Awka Market Prices,{' '}
              <span className="text-emerald-700">Delivered to Your Lodge Junction.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Skip the commute and the 25%–35% campus kiosk markup. Join scheduled batch runs
              aligned with your lecture breaks from ₦350.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
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
          <div className="md:col-span-5 bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="p-4 rounded-xl bg-emerald-700 text-white flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wider">
                  Next Cutoff • {cutoff.label}
                </p>
                <p className="text-xs text-emerald-50 mt-0.5">
                  Dynamo • School Gate • Aroma
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xl font-extrabold tabular-nums">
                <Clock className="w-4 h-4 text-emerald-200" />
                <span>
                  {hrs}:{mins}:{secs}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="spend-slider" className="text-sm font-semibold text-slate-800">
                  Monthly Foodstuff Spend
                </label>
                <span className="text-sm font-bold text-slate-900">
                  ₦{monthlySpend.toLocaleString()}
                </span>
              </div>
              <input
                id="spend-slider"
                type="range"
                min={10000}
                max={100000}
                step={5000}
                value={monthlySpend}
                onChange={(e) => setMonthlySpend(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
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

      {/* Asymmetric Value & Daily Batch Schedule */}
      <section className="max-w-7xl mx-auto px-4 py-12 grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Lecture-Aligned Drops</h3>
              <p className="text-sm text-slate-600 mt-1">
                From ₦350 to nearby lodge junctions (School Gate, Aroma, Dynamo).
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                4-Digit PIN &amp; Roommate Delegate
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Stuck in a lab? Rotate your PIN and delegate pickup to your roommate via
                WhatsApp in one tap.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Smart Routing &amp; Instant Settlement
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Multi-stall order splitting with live camera pickup verification.
              </p>
            </div>
          </div>
        </div>

        {/* Daily Batch Schedule Table */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-900 text-base">Daily UNIZIK Batch Schedule</h2>
            <p className="text-xs text-slate-500">Order before cutoff for same-day junction drop</p>
          </div>
          <div className="divide-y divide-slate-200">
            {BATCH_SLOTS.map((slot) => (
              <div key={slot.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{slot.label}</p>
                  <p className="text-xs text-slate-500">Cutoff: {slot.cutoff}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-700">{slot.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
