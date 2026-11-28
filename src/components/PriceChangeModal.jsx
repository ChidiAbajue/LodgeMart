import React, { useState } from 'react';
import { TrendingUp, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { prettyDate } from '../lib/adapters';
import Modal, { TextField, ActionButton } from './ui/Modal';

/**
 * Price-spike safeguard. A vendor (or an admin on their behalf) reports that a
 * product's price went up for a batch students have already ordered. The server:
 *   ≤ ₦150/unit rise → LodgeMart absorbs it (vendor paid the new price)
 *   bigger rise      → item moves to another verified trader at the locked price
 *   no trader        → that item is refunded to the student's wallet
 * `endpoint`: '/vendor/price-change' or `/admin/vendors/${id}/price-change`.
 * `batches`: [{ batchDate, batchSlotId, label }] that contain this product.
 */
export default function PriceChangeModal({ open, onClose, endpoint, product, currentPrice, batches, onDone }) {
  const [batchKey, setBatchKey] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (!open || !product) return null;
  const chosen = batches.find((b) => `${b.batchDate}|${b.batchSlotId}` === (batchKey || `${batches[0]?.batchDate}|${batches[0]?.batchSlotId}`));

  const close = () => {
    setResult(null);
    setError('');
    setPrice('');
    setBatchKey('');
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!chosen) return;
    // The server also saves this as the stall's new catalogue price, so a typo
    // here would quietly lower it. This form is only for rises.
    if (!(Number(price) > currentPrice)) {
      setError(`Enter the new price. It must be more than the locked ₦${currentPrice.toLocaleString()}; to lower a price, edit your stock list.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api(endpoint, {
        method: 'POST',
        body: {
          productId: product.id,
          batchDate: chosen.batchDate,
          batchSlotId: chosen.batchSlotId,
          newWholesalePriceKobo: Math.round(Number(price) * 100),
        },
      });
      setResult(res);
      onDone?.();
    } catch (err) {
      setError(err.details?.[0]?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={close} icon={TrendingUp} title="Price went up" subtitle={`${product.name} · locked at ₦${currentPrice.toLocaleString()}`}>
      {result ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-display text-lg uppercase text-brand-700">
            <CheckCircle2 className="h-5 w-5" /> Students protected
          </p>
          <ul className="space-y-1.5 text-sm text-ink">
            <li>Absorbed by LodgeMart (≤ ₦150 rise): <strong>{result.absorbed}</strong> item(s), ₦{(result.absorbedKobo / 100).toLocaleString()}</li>
            <li>Moved to another trader at the locked price: <strong>{result.reassigned}</strong></li>
            <li>Refunded to students' wallets: <strong>{result.refunded}</strong> (₦{(result.refundedKobo / 100).toLocaleString()})</li>
            {result.unchanged > 0 && <li>Not affected (price didn't go up): {result.unchanged}</li>}
          </ul>
          <p className="text-sm text-muted">Future orders use the new price.</p>
          <ActionButton onClick={close}>Done</ActionButton>
        </div>
      ) : batches.length === 0 ? (
        <div className="space-y-4 text-sm text-muted">
          <p>No open student orders include this product, so nobody is affected. Just update your price in the stock list.</p>
          <ActionButton onClick={close}>OK</ActionButton>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <p className="text-[0.95rem] text-muted">
            Students already paid the locked price. Rises up to ₦150 per unit are absorbed by LodgeMart; bigger rises move the
            item to another trader at the locked price, or refund it to the student.
          </p>
          <label className="block">
            <span className="font-display text-xs font-medium uppercase tracking-[0.18em] text-ink">Batch</span>
            <select
              value={batchKey || `${batches[0].batchDate}|${batches[0].batchSlotId}`}
              onChange={(e) => setBatchKey(e.target.value)}
              className="mt-2 h-12 w-full rounded-md border-2 border-ink/10 bg-white px-3 text-ink focus:border-accent-500 focus:outline-none"
            >
              {batches.map((b) => (
                <option key={`${b.batchDate}|${b.batchSlotId}`} value={`${b.batchDate}|${b.batchSlotId}`}>
                  {b.label} · {prettyDate(b.batchDate)}
                </option>
              ))}
            </select>
          </label>
          <TextField label="New wholesale price per unit (₦)" type="number" min={1} required value={price} onChange={(e) => setPrice(e.target.value)} placeholder={`more than ${currentPrice}`} />
          {error && <p role="alert" className="rounded-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          <ActionButton type="submit" disabled={busy || !price}>{busy ? 'Applying...' : 'Report price rise'}</ActionButton>
        </form>
      )}
    </Modal>
  );
}
