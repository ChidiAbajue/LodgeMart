import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Star, AlertTriangle } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import Modal, { ActionButton } from './ui/Modal';

const ISSUE_TAGS = ['Short measure', 'Weevils / Dusty', 'Damaged pack', 'Missing item'];

export default function ItemRatingModal({ isOpen, onClose, order, items }) {
  const { submitOrderRating } = useLodgeMart();
  const [stars, setStars] = useState(5);
  const [flaggedItems, setFlaggedItems] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  const handleSubmit = async () => {
    if (stars <= 3 && Object.keys(flaggedItems).length === 0) {
      setError('For 1–3 stars, tick the item(s) that had a problem so only that stall is affected.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await submitOrderRating(order.id, stars, flaggedItems);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStars(5);
    setFlaggedItems({});
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Rate your batch order" subtitle={`Order ${order.label} · Blind vendor quality`} icon={Star}>
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-[0.95rem] font-semibold text-ink">How was the quality &amp; measure of your items?</p>
          <div className="mt-3 flex items-center justify-center gap-1.5" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((num) => (
              <motion.button
                key={num}
                type="button"
                role="radio"
                aria-checked={num === stars}
                aria-label={`${num} star${num > 1 ? 's' : ''}`}
                onClick={() => setStars(num)}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.85 }}
                className="p-1.5 cursor-pointer"
              >
                <motion.span
                  className="block"
                  animate={num <= stars ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3, delay: num <= stars ? num * 0.04 : 0 }}
                >
                  <Star className={`h-10 w-10 ${num <= stars ? 'fill-accent-500 text-accent-500' : 'text-ink/20'}`} />
                </motion.span>
              </motion.button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            {stars >= 4
              ? stars === 5
                ? 'Everything was great! 5 stars credits every stall that filled your order.'
                : '4–5 stars credits all fulfilling stalls equally.'
              : '1–3 stars: select only the specific item(s) with an issue.'}
          </p>
        </div>

        <AnimatePresence initial={false}>
          {stars <= 3 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.7, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-md border-2 border-accent-200 bg-accent-50 p-4">
                <p className="flex items-center gap-2 font-display text-xs font-medium uppercase tracking-[0.18em] text-accent-700">
                  <AlertTriangle className="h-4 w-4" /> Which item had an issue?
                </p>
                {items.map((item) => {
                  const isFlagged = Boolean(flaggedItems[item.itemId]);
                  return (
                    <div key={item.itemId} className="rounded-md border-2 border-ink/10 bg-white p-3">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isFlagged}
                          onChange={() => toggleFlagItem(item.itemId)}
                          className="h-4 w-4 accent-accent-600"
                        />
                        <span className="text-sm font-semibold text-ink">
                          {item.productName} ({item.qty}x)
                        </span>
                      </label>
                      {isFlagged && (
                        <div className="mt-2.5 flex flex-wrap gap-2 pl-7">
                          {ISSUE_TAGS.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setIssueTag(item.itemId, tag)}
                              className={`rounded px-2.5 py-1.5 font-display text-[11px] uppercase tracking-[0.1em] transition-colors cursor-pointer ${
                                flaggedItems[item.itemId] === tag ? 'bg-ink text-white' : 'bg-tile text-ink hover:bg-ink/10'
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
            </motion.div>
          )}
        </AnimatePresence>

        {stars <= 3 && (
          <p className="text-sm text-muted">Flagging an item earns you a bad-batch replacement credit.</p>
        )}
        {error && <p role="alert" className="rounded-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <ActionButton onClick={handleSubmit} disabled={busy}>{busy ? 'Submitting...' : 'Submit blind quality rating'}</ActionButton>
      </div>
    </Modal>
  );
}
