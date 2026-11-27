import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Pause, Play } from 'lucide-react';

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-accent-400/80" aria-hidden="true">
      <path fill="currentColor" d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
    </svg>
  );
}

/** Endless marquee strip. Pauses on hover and via a visible button; static under reduced motion. */
export default function Ticker({ items, label = 'LodgeMart facts' }) {
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const running = !reduce && !paused && !hover;

  const row = (hidden) => (
    <ul className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-8 whitespace-nowrap">
          <span>{item}</span>
          <Star />
        </li>
      ))}
    </ul>
  );

  return (
    <section
      aria-label={label}
      className="relative overflow-hidden border-t border-white/10 text-cream/60"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex h-16 items-center text-sm font-medium tracking-[0.02em] [mask-image:linear-gradient(90deg,transparent,black_8%,black_88%,transparent)]">
        <div
          className={`flex w-max ${reduce ? '' : 'lm-marquee'}`}
          style={{ animationPlayState: running ? 'running' : 'paused' }}
        >
          {row(false)}
          {row(true)}
        </div>
      </div>
      {!reduce && (
        <div className="absolute inset-y-0 right-0 flex items-center pl-10 pr-3">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-cream backdrop-blur-md transition-colors hover:bg-white/[0.12] cursor-pointer"
          aria-label={paused ? 'Play ticker' : 'Pause ticker'}
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        </div>
      )}
    </section>
  );
}
