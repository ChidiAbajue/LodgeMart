import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from 'motion/react';
import {
  ShoppingBag,
  PackageCheck,
  Store,
  Bike,
  LayoutDashboard,
  LogOut,
  LogIn,
  Wallet,
} from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import Logo from './brand/Logo';
import { SPRING, SPRING_POP } from '../lib/motion';

function CountBadge({ count, className = '' }) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={SPRING_POP}
          className={`min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-accent-500 text-ink text-[11px] font-bold tabular-nums ${className}`}
        >
          {count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export default function Navbar() {
  const { currentUser, logout, walletBalance, cart } = useLodgeMart();
  const location = useLocation();
  const navigate = useNavigate();

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // Over the landing hero photo the bar is transparent; once scrolled it turns solid white.
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 80));
  const dark = location.pathname === '/' && !scrolled;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavItems = () => {
    if (!currentUser) {
      return [{ to: '/shop', label: 'Shop', icon: ShoppingBag, badge: cartCount }];
    }
    switch (currentUser.role) {
      case 'vendor':
        return [{ to: '/vendor', label: 'Stall Portal', icon: Store }];
      case 'rider':
        return [{ to: '/rider', label: 'Dispatch', icon: Bike }];
      case 'admin':
        return [{ to: '/admin', label: 'Ops Admin', icon: LayoutDashboard }];
      default:
        return [
          { to: '/shop', label: 'Shop', icon: ShoppingBag, badge: cartCount },
          { to: '/orders', label: 'My Orders', icon: PackageCheck },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-[background-color,border-color,color] duration-500 ${
          dark
            ? 'bg-transparent text-white'
            : 'bg-white text-ink shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 rounded-lg" aria-label="LodgeMart home">
            <Logo markClassName="h-8 w-auto" animated tone={dark ? 'light' : 'brand'} />
            <span className={`hidden sm:inline-block font-display text-[10px] font-medium uppercase tracking-[0.2em] px-2 py-1 rounded border ${dark ? 'border-white/30 text-white/80' : 'border-brand-700/30 text-brand-700'}`}>
              UNIZIK Pilot
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Main">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`group/nav relative flex items-center gap-2 h-10 font-display text-sm font-medium uppercase tracking-[0.14em] transition-colors ${
                    active ? (dark ? 'text-white' : 'text-ink') : dark ? 'text-white/75 hover:text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  <span className="relative">{item.label}</span>
                  <span
                    className={`absolute inset-x-0 bottom-1 h-0.5 origin-left bg-accent-500 transition-transform duration-300 ease-[cubic-bezier(0.7,0,0.2,1)] ${
                      active ? 'scale-x-100' : 'scale-x-0 group-hover/nav:scale-x-100'
                    }`}
                  />
                  {item.badge !== undefined && <CountBadge count={item.badge} className="relative" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            {(!currentUser || currentUser.role === 'student') && (
              <div className="hidden sm:flex items-center gap-1.5 h-9 font-display text-sm font-medium tracking-[0.06em] tabular-nums">
                <Wallet className="w-4 h-4 text-accent-500" />
                <span>₦{walletBalance.toLocaleString()}</span>
              </div>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:block text-right">
                  <p className="font-display text-sm font-medium uppercase tracking-[0.06em] leading-tight">{currentUser.name}</p>
                  <p className="text-xs opacity-60 capitalize">{currentUser.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className={`flex items-center gap-1.5 h-10 px-4 rounded-md border-2 font-display text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300 active:scale-[0.97] cursor-pointer ${dark ? 'border-white/70 hover:bg-white hover:text-ink' : 'border-ink hover:bg-ink hover:text-white'}`}
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className={`flex items-center gap-1.5 h-10 px-5 rounded-md border-2 font-display text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300 active:scale-[0.97] ${dark ? 'border-white/80 text-white hover:bg-white hover:text-ink' : 'border-ink text-ink hover:bg-ink hover:text-white'}`}
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation (< 768px) for student, vendor, rider */}
      {(!currentUser || currentUser.role !== 'admin') && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white shadow-[0_-6px_24px_-12px_rgb(0_0_0/0.25)] flex items-center justify-around h-16 px-2 pb-[env(safe-area-inset-bottom)]"
          aria-label="Main"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 min-w-20 h-12 font-display text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
                  active ? 'text-accent-600' : 'text-muted'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tab-dot"
                    transition={SPRING}
                    className="absolute -top-2 h-1 w-8 rounded-full bg-accent-500"
                  />
                )}
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge !== undefined && (
                    <CountBadge count={item.badge} className="absolute -top-2 -right-3" />
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
