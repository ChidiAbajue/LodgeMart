import { motion, useReducedMotion } from 'motion/react';
import { EASE } from '../../lib/motion';

const GREEN = '#144E2F';
const ORANGE = '#F28724';

/**
 * LodgeMart mark (L + M, rider, cart, pin, speed lines), traced from the brand logo.
 * `animated` plays a one-time entrance: speed lines streak in, then the pin drops.
 * `tone="light"` swaps green for white, for use on green/dark surfaces.
 */
export function LogoMark({ className = 'h-9 w-auto', animated = false, tone = 'brand', title = 'LodgeMart' }) {
  const reduce = useReducedMotion();
  const play = animated && !reduce;
  const green = tone === 'light' ? '#FFFFFF' : GREEN;

  const line = (i) =>
    play
      ? {
          initial: { x: -60, opacity: 0, scaleX: 0.4 },
          animate: { x: 0, opacity: 1, scaleX: 1 },
          transition: { duration: 0.42, ease: EASE, delay: 0.05 + i * 0.06 },
        }
      : {};

  return (
    <svg
      viewBox="0 0 560 350"
      className={className}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      <g fill={ORANGE}>
        <motion.polygon {...line(0)} style={{ transformOrigin: '206px 140px' }} points="66,141 206,128 203,150" />
        <motion.polygon {...line(1)} style={{ transformOrigin: '200px 190px' }} points="6,190 200,177 197,201" />
        <motion.polygon {...line(2)} style={{ transformOrigin: '192px 240px' }} points="66,240 192,228 189,250" />
      </g>
      <polygon fill={green} points="216,94 280,94 248,266 364,266 353,331 174,331" />
      <path fill="none" stroke={ORANGE} strokeWidth="20" strokeLinejoin="round" d="M270,266 L289,150 C298,92 340,62 404,70" />
      <g fill="none" stroke={ORANGE} strokeLinejoin="round">
        <path d="M304,154 L420,154 L396,232 L330,232 Z" strokeWidth="9" />
        <path d="M311,180 H412 M320,206 H404 M348,154 V232 M378,154 V232" strokeWidth="6" />
      </g>
      <polygon fill={ORANGE} points="478,148 538,148 516,331 462,331" />
      <polygon fill={ORANGE} points="424,148 484,148 438,234 404,214" />
      <motion.path
        fill={green}
        fillRule="evenodd"
        d="M396,336 C383,310 360,294 360,264 a36,36 0 1 1 72,0 C432,294 409,310 396,336 Z M396,250 a13,13 0 1 0 0.01,0 Z"
        {...(play
          ? {
              initial: { y: -70, opacity: 0 },
              animate: { y: 0, opacity: 1 },
              transition: { type: 'spring', stiffness: 520, damping: 22, delay: 0.32 },
            }
          : {})}
      />
      <g fill={green}>
        <circle cx="484" cy="46" r="29" />
        <path d="M466,30 Q494,8 516,32 L538,36 Q540,45 529,45 L460,44 Z" />
        <path d="M370,138 L416,88 Q440,66 468,78 L494,108 L538,124 Q550,133 539,144 L488,144 L464,118 L424,144 L372,144 Z" />
      </g>
      <path fill={ORANGE} d="M498,48 L517,48 Q516,71 497,74 Z" />
    </svg>
  );
}

/** Mark + "LodgeMart" wordmark (Lodge green, Mart orange), as in the brand logo. */
export default function Logo({ className = '', markClassName = 'h-8 w-auto', animated = false, tone = 'brand' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} animated={animated} tone={tone} title="" />
      <span className="text-[1.3rem] font-extrabold tracking-[-0.03em] leading-none">
        <span className={tone === 'light' ? 'text-white' : 'text-brand-700'}>Lodge</span>
        <span className="text-accent-500">Mart</span>
      </span>
    </span>
  );
}
