import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { MapPin, ShoppingBasket, Plus, Minus, X, Clock, BadgePercent, ArrowRight, ChevronDown, Search, Truck } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import { prettyDate, quoteDelivery } from '../lib/adapters';
import { getProductImage } from '../data/productImages';
import CheckoutModal from '../components/CheckoutModal';
import PageHeader from '../components/ui/PageHeader';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';

const SNAP = [0.7, 0, 0.2, 1];
const OUT = [0.16, 1, 0.3, 1];

function Select({ label, value, onChange, children }) {
  return (
    <label className="relative flex min-w-0 items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="h-10 w-full appearance-none truncate rounded-md border-2 border-ink/10 bg-white pl-3 pr-9 font-display text-sm font-medium uppercase tracking-[0.06em] text-ink transition-colors hover:border-ink/30 focus:border-accent-500 focus:outline-none cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted" />
    </label>
  );
}

export default function StorefrontPage() {
  const {
    currentUser,
    catalog,
    catalogError,
    refreshCatalog,
    products,
    zones,
    slots,
    feeRules,
    selectedZone,
    selectedZoneId,
    handleZoneChange,
    selectedHub,
    selectedHubId,
    setSelectedHub,
    selectedSlotId,
    selectedSlot,
    setSelectedBatchSlot,
    cart,
    addToCart,
    updateCartQty,
  } = useLodgeMart();

  const navigate = useNavigate();
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const currentZoneObj = zones.find((z) => z.id === selectedZoneId) || zones[0];
  const categories = ['All', ...new Set(products.map((p) => p.category))];

  // Search by name, category or unit (e.g. "rice", "carton", "oil").
  const q = query.trim().toLowerCase();
  const filteredProducts = products.filter(
    (p) =>
      (category === 'All' || p.category === category) &&
      (!q || `${p.name} ${p.category} ${p.unit}`.toLowerCase().includes(q)),
  );

  const cartDetails = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return product ? { ...item, product } : null;
    })
    .filter(Boolean);

  const itemsSubtotal = cartDetails.reduce(
    (sum, item) => sum + item.product.studentPrice * item.qty,
    0
  );
  const kioskSubtotal = cartDetails.reduce(
    (sum, item) => sum + item.product.kioskComparePrice * item.qty,
    0
  );
  const totalSavings = kioskSubtotal - itemsSubtotal;
  // Tiered delivery fee preview (the server recalculates it at checkout).
  const fee = quoteDelivery(cartDetails, feeRules);
  const totalPayable = itemsSubtotal > 0 ? itemsSubtotal + fee.deliveryFee : 0;
  const feeReason =
    fee.bracket === 'standard'
      ? 'Standard basket (up to ₦10,000)'
      : fee.bracket === 'large'
        ? 'Large basket (₦10,001 – ₦20,000)'
        : 'Large basket (+₦250 per ₦10,000 above ₦20,000)';
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const qtyOf = (id) => cart.find((i) => i.productId === id)?.qty || 0;

  const handleOrderSuccess = () => {
    setCheckoutOpen(false);
    setCartOpen(false);
    navigate('/orders');
  };

  const startCheckout = () => {
    if (!currentUser) {
      navigate('/login', { state: { from: '/shop' } });
      return;
    }
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-canvas pb-24 md:pb-16">
      <PageHeader kicker="Eke Awka stalls · one batch" title="Unified market">
        <p className="mt-4 max-w-xl text-base sm:text-lg text-white/75">
          One basket, many stalls. Every item is routed to the best-rated stall that has it in stock.
        </p>
      </PageHeader>

      {/* Sticky zone + hub bar */}
      <div className="sticky top-16 z-30 bg-white shadow-[0_6px_20px_-14px_rgb(0_0_0/0.35)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="grid w-full grid-cols-2 items-center gap-2 md:flex md:w-auto">
            <span className="hidden md:flex items-center gap-1.5 font-display text-xs font-medium uppercase tracking-[0.18em] text-accent-700">
              <MapPin className="h-4 w-4" /> Drop-off
            </span>
            <Select label="Campus zone" value={selectedZoneId} onChange={(e) => handleZoneChange(e.target.value)}>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </Select>
            <Select label="Pickup hub" value={selectedHubId} onChange={(e) => setSelectedHub(e.target.value)}>
              {(currentZoneObj?.hubs || []).map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.name}</option>
              ))}
            </Select>
          </div>

          <div className="hidden md:block">
            <Button onClick={() => setCartOpen(true)} size="sm" variant="accent">
              <ShoppingBasket className="h-4 w-4" />
              Basket ({cartCount})
              {itemsSubtotal > 0 && <span>· ₦{itemsSubtotal.toLocaleString()}</span>}
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <label className="relative flex items-center">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-4 h-5 w-5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rice, garri, Indomie, oil..."
            className="h-13 w-full rounded-md border-2 border-ink/10 bg-white pl-12 pr-4 text-base text-ink placeholder:text-muted/70 transition-colors focus:border-accent-500 focus:outline-none"
          />
        </label>
        {catalogError && !catalog && (
          <p role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {catalogError}
            <button onClick={refreshCatalog} className="underline cursor-pointer">Try again</button>
          </p>
        )}
      </div>

      {/* Category tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex items-center gap-7 overflow-x-auto border-b-2 border-ink/10" role="tablist" aria-label="Categories">
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(cat)}
                className={`relative shrink-0 pb-3 pt-1 font-display text-sm font-medium uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {cat}
                {active && (
                  <motion.span
                    layoutId="cat-underline"
                    className="absolute inset-x-0 -bottom-0.5 h-[3px] bg-accent-500"
                    transition={{ duration: 0.35, ease: SNAP }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {catalog && filteredProducts.length === 0 && (
        <p className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 text-center text-muted">
          No products match “{query}”. Try another word.
        </p>
      )}

      {/* Product grid */}
      <motion.div layout className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {filteredProducts.map((product, i) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: OUT, delay: i * 0.04 } }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            >
              <ProductCard
                product={product}
                qty={qtyOf(product.id)}
                onAdd={(id) => addToCart(id, 1)}
                onChangeQty={updateCartQty}
                eager={i < 4}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Mobile basket bar */}
      <AnimatePresence>
        {cartCount > 0 && !cartOpen && (
          <motion.button
            type="button"
            onClick={() => setCartOpen(true)}
            initial={{ y: 90 }}
            animate={{ y: 0 }}
            exit={{ y: 90 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="md:hidden fixed inset-x-3 bottom-[4.5rem] z-40 flex h-14 items-center justify-between rounded-md bg-accent-500 px-4 font-display uppercase tracking-[0.1em] text-ink shadow-[0_12px_30px_-10px_rgb(0_0_0/0.5)] cursor-pointer"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShoppingBasket className="h-5 w-5" /> {cartCount} in basket
            </span>
            <span className="flex items-center gap-1.5 text-base font-semibold">
              ₦{itemsSubtotal.toLocaleString()} <ArrowRight className="h-4 w-4" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Basket drawer */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end"
            initial={{ opacity: 1 }}
            exit={{ opacity: 1 }}
          >
            <motion.div
              className="absolute inset-0 bg-ink/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setCartOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Your batch basket"
              className="relative flex h-full w-full max-w-md flex-col bg-white"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.5, ease: SNAP }}
            >
              <div className="flex items-start justify-between bg-ink px-6 py-5 text-white">
                <div>
                  <h2 className="font-display text-2xl font-medium uppercase">Your batch basket</h2>
                  <p className="mt-1 text-sm text-white/60">
                    Drop-off: {selectedZone} · {selectedHub}
                  </p>
                </div>
                <button
                  onClick={() => setCartOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                  aria-label="Close basket"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7" data-lenis-prevent>
                {cartDetails.length === 0 ? (
                  <div className="py-16 text-center">
                    <ShoppingBasket className="mx-auto h-12 w-12 text-ink/20" />
                    <p className="mt-4 font-display text-lg uppercase text-ink">Your basket is empty</p>
                    <p className="mt-1 text-sm text-muted">Add staples from the unified market to join the next batch.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 rounded-md bg-brand-700 px-4 py-3 text-white">
                      <BadgePercent className="h-5 w-5 shrink-0 text-accent-400" />
                      <span className="text-sm font-semibold">
                        You saved ₦{totalSavings.toLocaleString()} vs. Campus Kiosks!
                      </span>
                    </div>

                    <ul className="divide-y divide-ink/10">
                      <AnimatePresence initial={false}>
                        {cartDetails.map(({ product, qty }) => (
                          <motion.li
                            key={product.id}
                            layout
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30, height: 0 }}
                            transition={{ duration: 0.3, ease: OUT }}
                            className="flex items-center gap-4 py-4"
                          >
                            <div className="h-16 w-16 shrink-0 rounded-md bg-tile p-1.5">
                              {getProductImage(product.id) ? (
                                <img src={getProductImage(product.id)} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <span className="flex h-full items-center justify-center text-2xl">{product.emoji}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-display text-base font-medium uppercase leading-tight text-ink">{product.name}</p>
                              <p className="mt-0.5 text-sm text-muted">
                                ₦{product.studentPrice.toLocaleString()} × {qty}
                              </p>
                            </div>
                            <div className="flex items-center rounded-md border-2 border-ink/10">
                              <button
                                onClick={() => updateCartQty(product.id, qty - 1)}
                                className="flex h-9 w-9 items-center justify-center text-ink transition-colors hover:bg-tile cursor-pointer"
                                aria-label={`Remove one ${product.name}`}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-6 text-center font-display text-sm font-medium tabular-nums">{qty}</span>
                              <button
                                onClick={() => updateCartQty(product.id, qty + 1)}
                                className="flex h-9 w-9 items-center justify-center text-ink transition-colors hover:bg-tile cursor-pointer"
                                aria-label={`Add one more ${product.name}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>

                    <fieldset>
                      <legend className="flex items-center gap-2 font-display text-xs font-medium uppercase tracking-[0.2em] text-accent-700">
                        <Clock className="h-4 w-4" /> Evening delivery · Mon – Sat
                      </legend>
                      <div className="mt-3 space-y-2.5">
                        {slots.map((slot) => {
                          const selected = selectedSlotId === slot.id;
                          return (
                            <label
                              key={slot.id}
                              className={`flex cursor-pointer items-center justify-between rounded-md border-2 px-4 py-3 transition-colors ${
                                selected ? 'border-accent-500 bg-accent-50' : 'border-ink/10 hover:border-ink/25'
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="batchSlot"
                                  checked={selected}
                                  onChange={() => setSelectedBatchSlot(slot.id)}
                                  className="h-4 w-4 accent-accent-600"
                                />
                                <span>
                                  <span className="block font-display text-base font-medium uppercase text-ink">{slot.label}</span>
                                  <span className="block text-sm text-muted">
                                    {slot.time} · {prettyDate(slot.nextBatchDate)} · order by {slot.cutoff}
                                  </span>
                                </span>
                              </span>
                              <span className="rounded bg-ink px-2 py-1 font-display text-[10px] uppercase tracking-[0.12em] text-white">
                                {slot.badge}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </>
                )}
              </div>

              {cartDetails.length > 0 && (
                <div className="border-t-2 border-ink/10 bg-canvas px-6 py-5 space-y-4">
                  <dl className="space-y-1.5 text-[0.95rem]">
                    <div className="flex justify-between text-muted">
                      <dt>Items subtotal</dt>
                      <dd className="tabular-nums">₦{itemsSubtotal.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between text-muted">
                      <dt className="flex items-center gap-1.5">
                        <Truck className="h-4 w-4" /> Delivery fee
                      </dt>
                      <dd className="tabular-nums">₦{fee.deliveryFee.toLocaleString()}</dd>
                    </div>
                    <div className="space-y-0.5 rounded-md bg-white px-3 py-2 text-xs text-muted">
                      <p className="flex justify-between">
                        <span>{feeReason}</span>
                        <span className="tabular-nums">₦{fee.baseFee.toLocaleString()}</span>
                      </p>
                      {fee.bulkCount > 0 && (
                        <p className="flex justify-between">
                          <span>Bulk item surcharge ({fee.bulkCount} × ₦250)</span>
                          <span className="tabular-nums">₦{fee.bulkSurcharge.toLocaleString()}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between border-t border-ink/10 pt-2 font-display uppercase text-ink">
                      <dt className="text-lg">Total</dt>
                      <dd className="text-3xl font-semibold tabular-nums">₦{totalPayable.toLocaleString()}</dd>
                    </div>
                  </dl>
                  <Button onClick={startCheckout} size="lg" variant="accent" className="w-full">
                    {currentUser ? 'Proceed to checkout' : 'Sign in to check out'} <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        totalAmount={totalPayable}
        batchSlot={selectedSlot ? `${selectedSlot.label} · ${prettyDate(selectedSlot.nextBatchDate)} · ${selectedHub}` : ''}
        onOrderSuccess={handleOrderSuccess}
      />
    </div>
  );
}
