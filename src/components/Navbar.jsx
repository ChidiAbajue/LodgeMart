import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
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
      <header className="sticky top-0 z-40 bg-white/95 border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 rounded-lg" aria-label="LodgeMart home">
            <Logo markClassName="h-8 w-auto" animated />
            <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
              UNIZIK Pilot
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold transition-colors ${
                    active ? 'text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={SPRING}
                      className="absolute inset-0 rounded-full bg-brand-700"
                    />
                  )}
                  <Icon className="relative w-4 h-4" />
                  <span className="relative">{item.label}</span>
                  {item.badge !== undefined && <CountBadge count={item.badge} className="relative" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            {(!currentUser || currentUser.role === 'student') && (
              <div className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-full bg-canvas border border-line text-sm font-semibold text-ink tabular-nums">
                <Wallet className="w-4 h-4 text-brand-700" />
                <span>₦{walletBalance.toLocaleString()}</span>
              </div>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-ink leading-tight">{currentUser.name}</p>
                  <p className="text-xs text-muted capitalize">{currentUser.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-line text-sm font-semibold text-ink transition-colors hover:border-ink/25 active:scale-[0.97] cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-700 text-white text-sm font-semibold transition-[transform,background-color] hover:bg-brand-800 hover:-translate-y-px active:scale-[0.97]"
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
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line flex items-center justify-around h-16 px-2 pb-[env(safe-area-inset-bottom)]"
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
                className={`relative flex flex-col items-center justify-center gap-1 min-w-20 h-12 rounded-xl text-xs font-semibold transition-colors ${
                  active ? 'text-brand-700' : 'text-muted'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tab-dot"
                    transition={SPRING}
                    className="absolute -top-2 h-1 w-8 rounded-full bg-brand-700"
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
