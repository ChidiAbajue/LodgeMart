import { AnimatePresence, motion } from 'motion/react';
import { EASE } from '../../lib/motion';

/** Each character rolls up when it changes (countdowns, counters). Static chars (":") don't move. */
export default function RollingDigits({ value, className = '' }) {
  const chars = String(value).split('');
  return (
    <span className={`inline-flex tabular-nums ${className}`} aria-label={String(value)} role="text">
      {chars.map((ch, i) => (
        <span key={i} className="relative inline-block overflow-hidden" aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              className="inline-block"
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
