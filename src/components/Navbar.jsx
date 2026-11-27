import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-lg">
              L
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">
                LodgeMart
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                UNIZIK Pilot
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-700 text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {(!currentUser || currentUser.role === 'student') && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                <span>₦{walletBalance.toLocaleString()}</span>
              </div>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-semibold text-slate-900 leading-tight">
                    {currentUser.name}
                  </p>
                  <p className="text-[11px] text-slate-500 capitalize">
                    {currentUser.role}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (< 768px) for Student, Vendor, Rider */}
      {(!currentUser || currentUser.role !== 'admin') && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium ${
                  active ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-700 text-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
