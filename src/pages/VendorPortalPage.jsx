import React, { useState } from 'react';
import { Store, Wallet, CheckCircle2, Circle, Package, Save } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import { useToast } from '../context/ToastContext';

export default function VendorPortalPage() {
  const {
    currentUser,
    vendors,
    products,
    orderItems,
    orders,
    toggleItemPacked,
    updateVendorInventory,
  } = useLodgeMart();

  const vendor = vendors.find((v) => v.id === currentUser?.vendorId);
  const { addToast } = useToast();
  const [drafts, setDrafts] = useState({});

  if (!vendor) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-sm text-slate-600">
          Please sign in with a Vendor account to access your stall portal.
        </p>
      </div>
    );
  }

  const myItems = orderItems.filter((item) => item.assignedVendorId === vendor.id);
  const pendingItems = myItems.filter((item) => !item.riderPickedUp);

  // Bulk Summary grouped by productId
  const bulkMap = pendingItems.reduce((acc, item) => {
    if (!acc[item.productId]) {
      acc[item.productId] = {
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        totalQty: 0,
      };
    }
    acc[item.productId].totalQty += item.qty;
    return acc;
  }, {});
  const bulkSummary = Object.values(bulkMap);

  // Tagged Student Bags grouped by orderId
  const bagsMap = pendingItems.reduce((acc, item) => {
    if (!acc[item.orderId]) {
      const orderObj = orders.find((o) => o.id === item.orderId);
      acc[item.orderId] = {
        orderId: item.orderId,
        hub: orderObj?.pickupHub || 'Junction',
        batchSlot: orderObj?.batchSlot || '',
        items: [],
      };
    }
    acc[item.orderId].items.push(item);
    return acc;
  }, {});
  const taggedBags = Object.values(bagsMap);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-12">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Zero-Holdback Ledger Header */}
        <div className="bg-emerald-700 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold flex-wrap">
              <Store className="w-4 h-4" />
              <span>
                {vendor.name} • {vendor.market} ({vendor.stallNumber}) • {vendor.ratingScore}★
              </span>
              {vendor.priorityTier && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-100 text-[10px] font-bold">
                  Priority Supplier Tier
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold">
              ₦{vendor.walletBalance.toLocaleString()}
            </h1>
            <p className="text-xs text-emerald-100">
              Available / Paid Today • {vendor.bankAccount}
            </p>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-200" />
            <span className="text-xs font-semibold">
              100% Instant Payout on Rider Pickup — ₦0 Withheld
            </span>
          </div>
        </div>

        {/* Bulk Summary */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-700" />
            <span>Bulk Summary (Total to Measure)</span>
          </h2>
          {bulkSummary.length === 0 ? (
            <p className="text-xs text-slate-500">All assigned items have been picked up.</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3">
              {bulkSummary.map((b) => (
                <div
                  key={b.productId}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">{b.productName}</p>
                    <p className="text-[11px] text-slate-500">{b.unit}</p>
                  </div>
                  <span className="text-lg font-extrabold text-emerald-700">{b.totalQty}×</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tagged Student Bags */}
        <section className="space-y-3">
          <h2 className="font-bold text-slate-900 text-sm">
            Tagged Student Bags ({taggedBags.length})
          </h2>

          {taggedBags.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No pending bags to pack right now.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {taggedBags.map((bag) => (
                <div
                  key={bag.orderId}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="font-extrabold text-slate-900 text-sm">
                        Tag {bag.orderId}
                      </span>
                      <p className="text-[11px] text-slate-500">{bag.hub}</p>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {bag.items.filter((i) => i.vendorPacked).length}/{bag.items.length} Packed
                    </span>
                  </div>

                  <div className="space-y-2">
                    {bag.items.map((item) => (
                      <button
                        key={item.itemId}
                        onClick={() => toggleItemPacked(item.itemId)}
                        className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
                          item.vendorPacked
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">
                            {item.qty}× {item.productName}
                          </p>
                          <p className="text-[11px] opacity-75">
                            Wholesale: ₦{(item.wholesaleCost * item.qty).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          {item.vendorPacked ? (
                            <>
                              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                              <span className="text-emerald-700">Packed</span>
                            </>
                          ) : (
                            <>
                              <Circle className="w-5 h-5 text-slate-400" />
                              <span>Mark Packed</span>
                            </>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Stall Inventory & Prices */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">
              My Stall Inventory &amp; Wholesale Prices
            </h2>
            <p className="text-xs text-slate-500">
              Update your wholesale price (₦) and available stock quantity for each product.
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {Object.entries(vendor.inventory).map(([productId, inv]) => {
              const product = products.find((p) => p.id === productId);
              if (!product) return null;
              const draft = drafts[productId] || {
                wholesalePrice: inv.wholesalePrice,
                stockQty: inv.stockQty,
              };

              return (
                <div
                  key={productId}
                  className="py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">{product.name}</p>
                    <p className="text-[11px] text-slate-500">{product.unit}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400">Price (₦)</label>
                      <input
                        type="number"
                        min={0}
                        value={draft.wholesalePrice}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [productId]: {
                              ...draft,
                              wholesalePrice: e.target.value,
                            },
                          }))
                        }
                        className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Stock Qty</label>
                      <input
                        type="number"
                        min={0}
                        value={draft.stockQty}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [productId]: {
                              ...draft,
                              stockQty: e.target.value,
                            },
                          }))
                        }
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                      />
                    </div>
                    <button
                      onClick={() => {
                        updateVendorInventory(
                          vendor.id,
                          productId,
                          draft.wholesalePrice,
                          draft.stockQty
                        );
                        addToast(`Updated ${product.name} price & stock`);
                      }}
                      className="mt-3.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
