import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { SANDBOX_ACCOUNTS } from '../data/seedData';
import { useLodgeMart } from '../context/LodgeMartContext';

const SNAP = [0.7, 0, 0.2, 1];
const OUT = [0.16, 1, 0.3, 1];

function Field({ label, icon: Icon, ...props }) {
  return (
    <label className="block">
      <span className="font-display text-xs font-medium uppercase tracking-[0.18em] text-ink">{label}</span>
      <span className="relative mt-2 flex items-center">
        <Icon className="pointer-events-none absolute left-4 h-4 w-4 text-muted" />
        <input
          {...props}
          className="h-13 w-full rounded-md border-2 border-ink/10 bg-white pl-11 pr-4 text-base text-ink placeholder:text-muted/60 transition-colors focus:border-accent-500 focus:outline-none"
        />
      </span>
    </label>
  );
}

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
    <div className="grid min-h-[calc(100svh-4rem)] bg-canvas lg:grid-cols-2">
      {/* Photo panel */}
      <div className="relative hidden overflow-hidden bg-ink text-white lg:block">
        <motion.img
          src="/images/hero-eke-awka.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.8, ease: OUT }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/40" />
        <div className="relative flex h-full flex-col justify-end p-12 xl:p-16">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-accent-400">UNIZIK Pilot</p>
          <h2 className="mt-3 overflow-hidden font-display text-6xl xl:text-7xl font-semibold uppercase leading-[0.95]">
            <motion.span className="block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: SNAP, delay: 0.1 }}>
              Eke Awka prices,
            </motion.span>
          </h2>
          <h2 className="overflow-hidden font-display text-6xl xl:text-7xl font-semibold uppercase leading-[0.95] text-accent-500">
            <motion.span className="block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: SNAP, delay: 0.2 }}>
              lodge junction.
            </motion.span>
          </h2>
          <p className="mt-5 max-w-md text-white/70">UNIZIK Campus Batch Foodstuff &amp; Operations Platform</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-10">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: OUT }}
        >
          <p className="font-display text-xs font-medium uppercase tracking-[0.3em] text-accent-700">Portal sign in</p>
          <h1 className="mt-3 font-display text-5xl font-semibold uppercase leading-none text-ink">Sign in to LodgeMart</h1>
          <p className="mt-3 text-muted lg:hidden">UNIZIK Campus Batch Foodstuff &amp; Operations Platform</p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5">
            <Field
              label="Email address"
              icon={Mail}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@unizik.edu.ng"
              autoComplete="email"
            />
            <Field
              label="Password"
              icon={Lock}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
                transition={{ duration: 0.4 }}
                role="alert"
                className="rounded-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="relative isolate flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-md bg-accent-500 font-display text-sm font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:text-white disabled:opacity-60 cursor-pointer before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-ink before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.7,0,0.2,1)] hover:before:scale-x-100 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10">
            <p className="flex items-center gap-3 font-display text-xs font-medium uppercase tracking-[0.2em] text-muted">
              <span className="h-px flex-1 bg-ink/10" />
              Quick sign-in (sandbox accounts)
              <span className="h-px flex-1 bg-ink/10" />
            </p>
            <div className="mt-4 grid gap-2.5">
              {SANDBOX_ACCOUNTS.map((acc, i) => (
                <motion.button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickFill(acc)}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease: OUT, delay: 0.25 + i * 0.07 }}
                  className="group relative flex w-full items-center justify-between overflow-hidden rounded-md border-2 border-ink/10 bg-white px-4 py-3 text-left transition-colors duration-300 hover:border-ink cursor-pointer"
                >
                  <span className="absolute inset-y-0 left-0 w-1 origin-bottom scale-y-0 bg-accent-500 transition-transform duration-300 group-hover:scale-y-100" />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{acc.email}</span>
                    <span className="block text-sm text-muted">{acc.subtitle}</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-display text-xs font-medium uppercase tracking-[0.14em] text-accent-700">
                    {acc.role}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
