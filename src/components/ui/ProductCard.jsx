import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus, ShoppingBasket } from 'lucide-react';
import { getProductImage } from '../../data/productImages';
import { naira } from '../../lib/format';

const SNAP = [0.7, 0, 0.2, 1];

/** Shop tile: product on a warm grey square, category, name, unit, price vs kiosk, add → stepper. */
export default function ProductCard({ product, qty = 0, onAdd, onChangeQty, eager = false }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = getProductImage(product.id);
  const save = product.kioskComparePrice - product.studentPrice;

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-tile">
        {src && !imgFailed ? (
          <img
            src={src}
            alt={product.name}
            width="800"
            height="800"
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-contain p-[8%] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-6xl" aria-hidden="true">
            {product.emoji}
          </span>
        )}
        {save > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-brand-700 px-2.5 py-1 font-display text-[11px] font-medium uppercase tracking-[0.08em] text-white">
            Save {naira(save)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center px-1 pt-4 text-center">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">{product.category}</p>
        <h3 className="mt-1.5 font-display text-lg font-medium uppercase leading-tight tracking-[0.01em] text-ink">
          {product.name}
        </h3>
        <p className="mt-0.5 text-sm text-muted">{product.unit}</p>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold text-ink">{naira(product.studentPrice)}</span>
          <span className="text-sm text-muted line-through" aria-label={`Kiosk price ${naira(product.kioskComparePrice)}`}>
            {naira(product.kioskComparePrice)}
          </span>
        </p>

        <div className="mt-4 h-11 w-full max-w-[220px]">
          <AnimatePresence mode="popLayout" initial={false}>
            {qty > 0 ? (
              <motion.div
                key="stepper"
                initial={{ clipPath: 'inset(0 50% 0 50%)' }}
                animate={{ clipPath: 'inset(0 0% 0 0%)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: SNAP }}
                className="flex h-11 items-center justify-between rounded-md bg-brand-700 px-1 text-white"
              >
                <button
                  type="button"
                  onClick={() => onChangeQty(product.id, qty - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded transition-colors hover:bg-white/15 active:scale-90 cursor-pointer"
                  aria-label={`Remove one ${product.name}`}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="relative h-6 overflow-hidden font-display text-base font-medium tabular-nums" aria-live="polite">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={qty}
                      className="block"
                      initial={{ y: 18 }}
                      animate={{ y: 0 }}
                      exit={{ y: -18 }}
                      transition={{ duration: 0.25, ease: SNAP }}
                    >
                      {qty}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <button
                  type="button"
                  onClick={() => onChangeQty(product.id, qty + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded transition-colors hover:bg-white/15 active:scale-90 cursor-pointer"
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
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="group/add relative isolate flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-md border-2 border-ink font-display text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:text-white cursor-pointer before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-ink before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.7,0,0.2,1)] hover:before:scale-x-100 active:scale-[0.97]"
              >
                <ShoppingBasket className="h-4 w-4" />
                Add to basket
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}
