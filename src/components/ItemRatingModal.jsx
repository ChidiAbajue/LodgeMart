import React, { useState } from 'react';
import { X, Star, AlertTriangle } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';

const ISSUE_TAGS = ['Short measure', 'Weevils / Dusty', 'Damaged pack', 'Missing item'];

export default function ItemRatingModal({ isOpen, onClose, order, items }) {
  const { submitOrderRating } = useLodgeMart();
  const [stars, setStars] = useState(5);
  const [flaggedItems, setFlaggedItems] = useState({});

  if (!isOpen || !order) return null;

  const toggleFlagItem = (itemId) => {
    setFlaggedItems((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = ISSUE_TAGS[0];
      }
      return next;
    });
  };

  const setIssueTag = (itemId, tag) => {
    setFlaggedItems((prev) => ({ ...prev, [itemId]: tag }));
  };

  const handleSubmit = () => {
    submitOrderRating(order.id, stars, flaggedItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Rate Your Batch Order</h3>
            <p className="text-xs text-slate-500">Order {order.id} • Blind Vendor Quality</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-slate-700">
              How was the quality &amp; measure of your items?
            </p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  aria-label={`Rate ${num} star${num > 1 ? 's' : ''}`}
                  onClick={() => setStars(num)}
                  className="p-1.5 cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      num <= stars
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-slate-700">
              {['Poor', 'Fair', 'Good', 'Great', 'Excellent'][stars - 1]} ({stars}/5)
            </p>
            <p className="text-xs text-slate-500">
              {stars >= 4
                ? '4–5 stars credits all fulfilling stalls equally.'
                : '1–3 stars: select only the specific item(s) with an issue.'}
            </p>
          </div>

          {stars <= 3 && (
            <div className="space-y-2.5 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                <span>Which item had an issue?</span>
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const isFlagged = Boolean(flaggedItems[item.itemId]);
                  return (
                    <div
                      key={item.itemId}
                      className="p-2.5 rounded-lg bg-white border border-amber-200 space-y-2"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFlagged}
                          onChange={() => toggleFlagItem(item.itemId)}
                          className="accent-amber-600"
                        />
                        <span className="text-xs font-semibold text-slate-900">
                          {item.productName} ({item.qty}x)
                        </span>
                      </label>

                      {isFlagged && (
                        <div className="flex flex-wrap gap-1.5 pl-6">
                          {ISSUE_TAGS.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setIssueTag(item.itemId, tag)}
                              className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer ${
                                flaggedItems[item.itemId] === tag
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm cursor-pointer"
          >
            Submit Blind Quality Rating
          </button>
        </div>
      </div>
    </div>
  );
}
