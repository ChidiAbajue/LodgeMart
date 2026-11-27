import { Link } from 'react-router-dom';
import { Wallet, CreditCard } from 'lucide-react';
import Logo from './brand/Logo';
import { ALL_HUBS, BATCH_SLOTS } from '../data/seedData';

const YEAR = new Date().getFullYear();
const linkCls = 'text-sm text-muted transition-colors hover:text-ink';

export default function Footer() {
  return (
    <footer className="border-t border-line bg-white pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-4 space-y-4">
          <Logo />
          <p className="text-sm text-muted max-w-xs leading-relaxed">
            Eke Awka market prices, batched and delivered to your UNIZIK lodge junction.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line text-xs font-semibold text-ink">
              <Wallet className="w-3.5 h-3.5 text-brand-700" /> LodgeMart Wallet
            </span>
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line text-xs font-semibold text-ink">
              <CreditCard className="w-3.5 h-3.5 text-brand-700" /> Paystack
            </span>
          </div>
        </div>

        <nav className="md:col-span-2" aria-label="Shop">
          <h2 className="text-sm font-bold text-ink mb-3">Shop</h2>
          <ul className="space-y-2">
            <li><Link to="/shop" className={linkCls}>Unified market</Link></li>
            <li><Link to="/orders" className={linkCls}>My orders</Link></li>
            <li><Link to="/login" className={linkCls}>Portal sign in</Link></li>
          </ul>
        </nav>

        <div className="md:col-span-3">
          <h2 className="text-sm font-bold text-ink mb-3">Pickup hubs</h2>
          <ul className="space-y-2">
            {ALL_HUBS.map((hub) => (
              <li key={hub} className="text-sm text-muted">{hub}</li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <h2 className="text-sm font-bold text-ink mb-3">Batch times</h2>
          <ul className="space-y-2">
            {BATCH_SLOTS.map((slot) => (
              <li key={slot.id} className="text-sm text-muted">
                <span className="font-semibold text-ink">{slot.label}</span> · {slot.time}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row gap-2 justify-between text-xs text-muted">
          <p>© {YEAR} LodgeMart · UNIZIK Pilot</p>
          <a href="/products/CREDITS.md" className="transition-colors hover:text-ink">
            Product photos: Wikimedia Commons contributors (CC BY-SA / CC BY / CC0)
          </a>
        </div>
      </div>
    </footer>
  );
}
