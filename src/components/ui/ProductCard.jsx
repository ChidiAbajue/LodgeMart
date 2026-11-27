import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus } from 'lucide-react';
import { getProductImage } from '../../data/productImages';
import { naira } from '../../lib/format';
import { EASE } from '../../lib/motion';

/** Catalog card: photo tile, name, unit, price vs kiosk, and an add button that morphs into a stepper. */
export default function ProductCard({ product, qty = 0, onAdd, onChangeQty, eager = false }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = getProductImage(product.id);

  return (
    <article className="group flex flex-col rounded-2xl bg-white border border-line p-2.5 shadow-card transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-canvas">
        {src && !imgFailed ? (
          <img
            src={src}
            alt={product.name}
            width="640"
            height="640"
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-6xl" aria-hidden="true">
            {product.emoji}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-1 pt-3">
        <h3 className="text-[0.95rem] font-bold leading-snug text-ink">{product.name}</h3>
        <p className="mt-0.5 text-[0.8rem] text-muted">{product.unit}</p>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-tight text-ink">{naira(product.studentPrice)}</span>
          <span className="text-[0.8rem] text-muted line-through" aria-label={`Kiosk price ${naira(product.kioskComparePrice)}`}>
            {naira(product.kioskComparePrice)}
          </span>
        </p>

        <div className="mt-3 h-10">
          <AnimatePresence mode="popLayout" initial={false}>
            {qty > 0 ? (
              <motion.div
                key="stepper"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="flex h-10 items-center justify-between rounded-full bg-brand-700 px-1 text-white"
              >
                <button
                  type="button"
                  onClick={() => onChangeQty(product.id, qty - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 active:scale-90 cursor-pointer"
                  aria-label={`Remove one ${product.name}`}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="relative h-5 overflow-hidden text-sm font-bold tabular-nums" aria-live="polite">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={qty}
                      className="block"
                      initial={{ y: 14, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -14, opacity: 0 }}
                      transition={{ duration: 0.18, ease: EASE }}
                    >
                      {qty}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <button
                  type="button"
                  onClick={() => onChangeQty(product.id, qty + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 active:scale-90 cursor-pointer"
                  aria-label={`Add one more ${product.name}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="add"
                type="button"
                onClick={() => onAdd(product.id)}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-line text-sm font-semibold text-ink transition-colors hover:border-brand-700 hover:text-brand-700 active:scale-[0.97] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add to cart
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}
