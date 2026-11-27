import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, ArrowRight, ChevronDown } from 'lucide-react';
import { SANDBOX_ACCOUNTS } from '../data/seedData';
import { useLodgeMart } from '../context/LodgeMartContext';

export default function LoginPage() {
  const { login } = useLodgeMart();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sandboxOpen, setSandboxOpen] = useState(false);

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
    }, 350);
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
        <div className="text-center space-y-2">
          <svg
            width="44"
            height="44"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="mx-auto"
          >
            <rect width="36" height="36" rx="10" fill="#047857" />
            <path
              d="M11 15.5H25L23.5 25.5H12.5L11 15.5Z"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M14.5 15.5V13C14.5 11.067 16.067 9.5 18 9.5C19.933 9.5 21.5 11.067 21.5 13V15.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="18" cy="20.5" r="1.5" fill="#FBBF24" />
          </svg>
          <h1 className="text-xl font-bold text-slate-900">Sign in to LodgeMart</h1>
          <p className="text-sm text-slate-500">
            UNIZIK Campus Batch Foodstuff &amp; Operations
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="login-email"
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
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="login-password"
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

        <div className="pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setSandboxOpen((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 cursor-pointer"
          >
            <span>Developer Sandbox Accounts</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${sandboxOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {sandboxOpen && (
            <div className="mt-2.5 grid grid-cols-1 gap-2">
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
                  <span className="text-xs font-semibold text-emerald-700 capitalize">
                    {acc.role} →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
