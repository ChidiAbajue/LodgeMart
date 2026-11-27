import { Link } from 'react-router-dom';
import Logo from './brand/Logo';
import { ALL_HUBS, BATCH_SLOTS } from '../data/seedData';

const YEAR = new Date().getFullYear();
const head = 'font-display text-lg font-medium uppercase tracking-[0.04em] text-white';
const linkCls = 'text-[0.95rem] text-white/60 transition-colors duration-200 hover:text-accent-400';

export default function Footer() {
  return (
    <footer className="bg-ink text-white pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4 space-y-5">
          <Logo tone="light" markClassName="h-9 w-auto" />
          <p className="max-w-xs text-[0.95rem] leading-relaxed text-white/60">
            Eke Awka market prices, batched and delivered to your UNIZIK lodge junction.
          </p>
          <p className="font-display text-xs uppercase tracking-[0.2em] text-accent-400">
            LodgeMart Wallet · Paystack
          </p>
        </div>

        <nav className="md:col-span-2" aria-label="Shop">
          <h2 className={head}>Shop</h2>
          <ul className="mt-4 space-y-2.5">
            <li><Link to="/shop" className={linkCls}>Unified market</Link></li>
            <li><Link to="/orders" className={linkCls}>My orders</Link></li>
            <li><Link to="/login" className={linkCls}>Portal sign in</Link></li>
          </ul>
        </nav>

        <div className="md:col-span-3">
          <h2 className={head}>Pickup hubs</h2>
          <ul className="mt-4 space-y-2.5">
            {ALL_HUBS.map((hub) => (
              <li key={hub} className="text-[0.95rem] text-white/60">{hub}</li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <h2 className={head}>Batch times</h2>
          <ul className="mt-4 space-y-2.5">
            {BATCH_SLOTS.map((slot) => (
              <li key={slot.id} className="text-[0.95rem] text-white/60">
                <span className="text-white">{slot.label}</span> · {slot.time}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-accent-500/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-2 justify-between text-sm text-white/50">
          <p>© {YEAR} LodgeMart · UNIZIK Pilot</p>
          <a href="/products/CREDITS.md" className="transition-colors hover:text-white">
            Photos: Wikimedia Commons contributors (CC BY-SA / CC BY / CC0)
          </a>
        </div>
      </div>
    </footer>
  );
}
