import { useEffect } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

const SNAP = [0.7, 0, 0.2, 1];

/** Shared dialog shell: ink header band, close button, Esc to close, sheet on mobile. */
export default function Modal({ open, onClose, title, subtitle, icon: Icon, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        className="absolute inset-0 bg-ink/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[92svh] w-full overflow-y-auto rounded-t-xl bg-white sm:rounded-xl ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'}`}
        data-lenis-prevent
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: SNAP }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between bg-ink px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            {Icon && <Icon className="mt-1 h-5 w-5 text-accent-400" />}
            <div>
              <h3 className="font-display text-2xl font-medium uppercase leading-tight">{title}</h3>
              {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

/** Shared form input in the site style. */
export function TextField({ label, ...props }) {
  return (
    <label className="block">
      <span className="font-display text-xs font-medium uppercase tracking-[0.18em] text-ink">{label}</span>
      <input
        {...props}
        className="mt-2 h-12 w-full rounded-md border-2 border-ink/10 bg-white px-4 text-base text-ink placeholder:text-muted/60 transition-colors focus:border-accent-500 focus:outline-none"
      />
    </label>
  );
}

/** Full-width solid action with the sweep hover. */
export function ActionButton({ as: Tag = 'button', className = '', children, ...props }) {
  return (
    <Tag
      {...props}
      className={`relative isolate flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-md bg-accent-500 font-display text-sm font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:text-white disabled:opacity-60 cursor-pointer before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-ink before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.7,0,0.2,1)] hover:before:scale-x-100 active:scale-[0.98] ${className}`}
    >
      {children}
    </Tag>
  );
}
