import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { SANDBOX_ACCOUNTS } from '../data/seedData';
import { useLodgeMart } from '../context/LodgeMartContext';

export default function LoginPage() {
  const { login } = useLodgeMart();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const performLogin = (targetEmail, targetPassword) => {
    setError('');
    setLoading(true);
    setTimeout(() => {
      const res = login(targetEmail, targetPassword);
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      navigate(res.user.homeRoute);
    }, 400);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    performLogin(email, password);
  };

  const handleQuickFill = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    performLogin(account.email, account.password);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white font-bold text-xl flex items-center justify-center mx-auto">
            L
          </div>
          <h1 className="text-xl font-bold text-slate-900">Sign in to LodgeMart</h1>
          <p className="text-xs text-slate-500">
            UNIZIK Campus Batch Foodstuff &amp; Operations Platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@unizik.edu.ng"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">
            Quick Sign-In (Sandbox Accounts)
          </p>
          <div className="grid grid-cols-1 gap-2">
            {SANDBOX_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => handleQuickFill(acc)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/40 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900">{acc.email}</p>
                  <p className="text-[11px] text-slate-500">{acc.subtitle}</p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 capitalize">
                  {acc.role} →
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
