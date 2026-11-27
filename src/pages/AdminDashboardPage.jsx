import React, { useState } from 'react';
import {
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Star,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { RIDER_COMMISSION } from '../data/seedData';
import { useLodgeMart } from '../context/LodgeMartContext';

export default function AdminDashboardPage() {
  const { orders, orderItems, vendors, resetSampleData } = useLodgeMart();
  const [expandedOrderId, setExpandedOrderId] = useState('#4082');

  // Unit Economics Calculations
  const totalGMV = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalDeliveryFees = orders.reduce((sum, o) => sum + o.deliveryFee, 0);
  const totalRetail = orderItems.reduce((sum, i) => sum + i.studentPrice * i.qty, 0);
  const totalWholesale = orderItems.reduce((sum, i) => sum + i.wholesaleCost * i.qty, 0);
  const grossMargin = totalRetail - totalWholesale + totalDeliveryFees;
  const vendorPayoutsSettled = vendors.reduce((sum, v) => sum + v.walletBalance, 0);
  const riderCommissions = orders.filter((o) => o.status === 'Collected').length * RIDER_COMMISSION;
  const netRetainedProfit = grossMargin - riderCommissions;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-slate-200 flex-col justify-between p-5">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
            <LayoutDashboard className="w-4 h-4" />
            <span>Ops &amp; Unit Economics</span>
          </div>
          <div className="space-y-1 text-xs text-slate-600">
            <p className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">
              Live Batch Overview
            </p>
            <p className="px-3 py-2">Multi-Vendor Split Inspector</p>
            <p className="px-3 py-2">Vendor Quality Leaderboard</p>
          </div>
        </div>

        {/* Discreet Reset Sample Data inside Admin Settings panel */}
        <div className="pt-4 border-t border-slate-200 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Admin Settings
          </p>
          <button
            onClick={resetSampleData}
            className="w-full py-2 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Sample Data</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              LodgeMart Operations Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Monitor batch unit economics, inspect multi-vendor line-item splits, and oversee
              automated vendor quality routing (&lt; 3.5★ suspension).
            </p>
          </div>
          <button
            onClick={resetSampleData}
            className="md:hidden px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Live Batch & Unit Economics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-[11px] text-slate-500 font-medium">Total GMV</p>
            <p className="text-lg font-extrabold text-slate-900 mt-1">
              ₦{totalGMV.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-[11px] text-slate-500 font-medium">Gross Margin</p>
            <p className="text-lg font-extrabold text-emerald-700 mt-1">
              ₦{grossMargin.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-[11px] text-slate-500 font-medium">Vendor Payouts (100%)</p>
            <p className="text-lg font-extrabold text-slate-900 mt-1">
              ₦{vendorPayoutsSettled.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-[11px] text-slate-500 font-medium">Rider Commissions</p>
            <p className="text-lg font-extrabold text-slate-900 mt-1">
              ₦{riderCommissions.toLocaleString()}
            </p>
          </div>
          <div className="bg-emerald-700 text-white p-4 rounded-xl col-span-2 lg:col-span-1">
            <p className="text-[11px] text-emerald-100 font-medium">
              Net Retained Profit (₦0 Payroll)
            </p>
            <p className="text-lg font-extrabold mt-1">
              ₦{netRetainedProfit.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Multi-Vendor Order Split Inspector */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-900 text-sm">
              Multi-Vendor Order Split Inspector
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {orders.map((order) => {
              const items = orderItems.filter((i) => i.orderId === order.id);
              const isExpanded = expandedOrderId === order.id;

              return (
                <div key={order.id} className="p-4">
                  <button
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="w-full flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="font-bold text-slate-900 text-sm">{order.id}</span>
                      <span className="text-xs text-slate-600">{order.studentName}</span>
                      {order.requiresBagMerge && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                          Split-Stall • Merge Bag
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-semibold text-emerald-700">{order.status}</span>
                      <span className="font-bold text-slate-900">
                        ₦{order.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 pl-6 space-y-2">
                      {items.map((item) => {
                        const v = vendors.find((ven) => ven.id === item.assignedVendorId);
                        return (
                          <div
                            key={item.itemId}
                            className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-semibold text-slate-900">
                                {item.qty}× {item.productName}
                              </span>
                              <span className="ml-2 text-slate-500">
                                → {v?.name} ({v?.stallNumber})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500">
                                Wholesale: ₦{(item.wholesaleCost * item.qty).toLocaleString()}
                              </span>
                              <span className="font-semibold text-slate-900">
                                Retail: ₦{(item.studentPrice * item.qty).toLocaleString()}
                              </span>
                              {item.issueTag && (
                                <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold">
                                  {item.issueTag}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Vendor Quality & Routing Leaderboard */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-900 text-sm">
              Vendor Quality &amp; Routing Leaderboard
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {vendors.map((v) => {
              const isSuspended = v.ratingScore < 3.5;
              return (
                <div
                  key={v.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      {v.name}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({v.market} • {v.stallNumber})
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Settled Today: ₦{v.walletBalance.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                      <span>{v.ratingScore}</span>
                      <span className="text-slate-400 font-normal">({v.ratingCount})</span>
                    </div>

                    {isSuspended ? (
                      <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Suspended (&lt; 3.5 Stars)</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Routing Active</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
