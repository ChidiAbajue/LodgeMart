import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Clock,
  Sparkles,
  CheckCircle2,
  Search,
  Wheat,
  Droplets,
  Package,
  Coffee,
} from 'lucide-react';
import { CAMPUS_ZONES, BATCH_SLOTS, calculateDeliveryFee } from '../data/seedData';
import { useLodgeMart } from '../context/LodgeMartContext';
import CheckoutModal from '../components/CheckoutModal';

export default function StorefrontPage() {
  const {
    products,
    vendors,
    selectedZone,
    handleZoneChange,
    selectedHub,
    setSelectedHub,
    selectedBatchSlot,
    setSelectedBatchSlot,
    cart,
    addToCart,
    updateCartQty,
  } = useLodgeMart();

  const navigate = useNavigate();
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const currentZoneObj = CAMPUS_ZONES.find((z) => z.name === selectedZone) || CAMPUS_ZONES[0];
  const categories = ['All', ...new Set(products.map((p) => p.category))];

  const filteredProducts = products.filter((p) => {
    const matchesCat = category === 'All' || p.category === category;
    const matchesQuery =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      p.unit.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return matchesCat && matchesQuery;
  });

  const getAvailableStock = (productId) =>
    vendors
      .filter((v) => v.ratingScore >= 3.5)
      .reduce((sum, v) => sum + (v.inventory[productId]?.stockQty || 0), 0);

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'Grains & Staples':
        return Wheat;
      case 'Cooking Oils':
        return Droplets;
      case 'Provisions':
        return Coffee;
      default:
        return Package;
    }
  };

  const cartDetails = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return product ? { ...item, product } : null;
    })
    .filter(Boolean);

  const {
    baseFee,
    bulkSurcharge,
    totalFee: deliveryFee,
    itemsSubtotal,
    bulkCount,
  } = calculateDeliveryFee(cart, products);
  const kioskSubtotal = cartDetails.reduce(
    (sum, item) => sum + item.product.kioskComparePrice * item.qty,
    0
  );
  const totalSavings = kioskSubtotal - itemsSubtotal;
  const totalPayable = itemsSubtotal > 0 ? itemsSubtotal + deliveryFee : 0;
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  const handleOrderSuccess = () => {
    setCheckoutOpen(false);
    setCartOpen(false);
    navigate('/orders');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-12">
      {/* Sticky Zone & Hub Selector Bar */}
      <div className="sticky top-16 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <MapPin className="w-4 h-4" />
              <span>Campus Zone:</span>
            </div>
            <select
              value={selectedZone}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-700"
            >
              {CAMPUS_ZONES.map((z) => (
                <option key={z.id} value={z.name}>
                  {z.name}
                </option>
              ))}
            </select>

            <span className="text-slate-300">/</span>

            <select
              value={selectedHub}
              onChange={(e) => setSelectedHub(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-700"
            >
              {currentZoneObj.hubs.map((hub) => (
                <option key={hub} value={hub}>
                  {hub}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Basket ({cartCount})</span>
            {itemsSubtotal > 0 && <span>• ₦{itemsSubtotal.toLocaleString()}</span>}
          </button>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rice, garri, indomie..."
            aria-label="Search products"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-emerald-700"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-colors ${
                category === cat
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Unified SKU Grid */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredProducts.map((product) => {
          const inCart = cart.find((i) => i.productId === product.id);
          const savings = product.kioskComparePrice - product.studentPrice;
          const stock = getAvailableStock(product.id);
          const CatIcon = getCategoryIcon(product.category);

          return (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CatIcon className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                    Save ₦{savings.toLocaleString()}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-sm">{product.name}</h3>
                    {product.isBulkItem && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                        Bulk Item (+₦250)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{product.unit}</p>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-extrabold text-slate-900">
                    ₦{product.studentPrice.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400 line-through">
                    Kiosk: ₦{product.kioskComparePrice.toLocaleString()}
                  </span>
                </div>

                {stock === 0 ? (
                  <button
                    disabled
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed"
                  >
                    Out of Stock
                  </button>
                ) : !inCart ? (
                  <button
                    onClick={() => addToCart(product.id, 1)}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to Basket</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-1">
                    <button
                      onClick={() => updateCartQty(product.id, inCart.qty - 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center text-emerald-700 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold text-emerald-900">{inCart.qty}</span>
                    <button
                      onClick={() => updateCartQty(product.id, inCart.qty + 1)}
                      className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-Over Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between border-l border-slate-200 shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-base">Your Batch Basket</h2>
                <p className="text-xs text-slate-500">
                  Drop-off: {selectedZone} • {selectedHub}
                </p>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {cartDetails.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-medium text-slate-600">Your basket is empty</p>
                  <p className="text-xs text-slate-400">
                    Add staples from the unified market to join the next batch.
                  </p>
                </div>
              ) : (
                <>
                  {/* Savings Badge */}
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-800">
                    <Sparkles className="w-4 h-4 shrink-0 text-emerald-700" />
                    <span className="text-xs font-semibold">
                      You saved ₦{totalSavings.toLocaleString()} vs. Campus Kiosks!
                    </span>
                  </div>

                  {/* Items */}
                  <div className="space-y-2.5">
                    {cartDetails.map(({ product, qty }) => (
                      <div
                        key={product.id}
                        className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{product.emoji}</span>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{product.name}</p>
                            <p className="text-[11px] text-slate-500">
                              ₦{product.studentPrice.toLocaleString()} × {qty}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQty(product.id, qty - 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{qty}</span>
                          <button
                            onClick={() => updateCartQty(product.id, qty + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Lecture-Aligned Batch Picker */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Lecture-Aligned Batch Slot</span>
                    </p>
                    <div className="space-y-2">
                      {BATCH_SLOTS.map((slot) => {
                        const fullLabel = `${slot.label} (${slot.time})`;
                        const selected = selectedBatchSlot === fullLabel;
                        return (
                          <label
                            key={slot.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                              selected
                                ? 'border-emerald-700 bg-emerald-50/50'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="radio"
                                name="batchSlot"
                                checked={selected}
                                onChange={() => setSelectedBatchSlot(fullLabel)}
                                className="accent-emerald-700"
                              />
                              <div>
                                <p className="text-xs font-bold text-slate-900">{slot.label}</p>
                                <p className="text-[11px] text-slate-500">{slot.time}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {slot.badge}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {cartDetails.length > 0 && (
              <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Items Subtotal</span>
                    <span>₦{itemsSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Tiered Delivery Fee (
                      {itemsSubtotal <= 10000 ? '₦1–₦10k' : '₦10k+ Bracket'})
                    </span>
                    <span>₦{baseFee.toLocaleString()}</span>
                  </div>
                  {bulkSurcharge > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Bulk Item Surcharge ({bulkCount}× ₦250)</span>
                      <span>+₦{bulkSurcharge.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total</span>
                    <span>₦{totalPayable.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => setCheckoutOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Proceed to Checkout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        totalAmount={totalPayable}
        batchSlot={selectedBatchSlot}
        onOrderSuccess={handleOrderSuccess}
      />
    </div>
  );
}
