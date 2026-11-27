import { motion } from 'motion/react';

const SNAP = [0.7, 0, 0.2, 1];

/** Inner-page photo header that sits under the transparent navbar. */
export default function PageHeader({ kicker, title, image = '/images/market-evening.webp', children }) {
  return (
    <section className="relative -mt-16 overflow-hidden bg-ink text-white">
      <motion.img
        src={image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ scale: 1.15 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/70 to-brand-900/80" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-14 sm:pt-36 sm:pb-16">
        {kicker && (
          <motion.p
            className="font-display text-xs font-medium uppercase tracking-[0.3em] text-accent-400"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: SNAP }}
          >
            {kicker}
          </motion.p>
        )}
        <h1 className="mt-3 overflow-hidden font-display text-5xl sm:text-6xl lg:text-7xl font-semibold uppercase leading-[0.95]">
          <motion.span
            className="block"
            initial={{ y: '105%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 0.8, ease: SNAP, delay: 0.1 }}
          >
            {title}
          </motion.span>
        </h1>
        {children && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
          >
            {children}
          </motion.div>
        )}
      </div>
    </section>
  );
}
