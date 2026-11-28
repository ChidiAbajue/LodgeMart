import { motion, useReducedMotion } from 'motion/react';

const EASE_SHARP = [0.7, 0, 0.2, 1];
const EASE_OUT = [0.16, 1, 0.3, 1];

const VARIANTS = {
  up: { hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } } },
  left: { hidden: { opacity: 0, x: -60 }, show: { opacity: 1, x: 0, transition: { duration: 0.8, ease: EASE_OUT } } },
  right: { hidden: { opacity: 0, x: 60 }, show: { opacity: 1, x: 0, transition: { duration: 0.8, ease: EASE_OUT } } },
  scale: { hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 20 } } },
  // image wipe: a hard-edged curtain lifts off the picture
  wipe: {
    hidden: { clipPath: 'inset(100% 0% 0% 0%)' },
    show: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.9, ease: EASE_SHARP } },
  },
};

/** Animate once when scrolled into view. `stagger` makes it a container for <Reveal.Item>. */
export default function Reveal({ as = 'div', variant = 'up', stagger = 0, delay = 0, amount = 0.25, className = '', children, ...rest }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  if (reduce) {
    const Plain = as;
    return <Plain className={className} {...rest}>{children}</Plain>;
  }
  const container = stagger
    ? { hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }
    : {
        hidden: VARIANTS[variant].hidden,
        show: { ...VARIANTS[variant].show, transition: { ...VARIANTS[variant].show.transition, delay } },
      };
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={container}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function Item({ as = 'div', variant = 'up', className = '', children, ...rest }) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Plain = as;
    return <Plain className={className} {...rest}>{children}</Plain>;
  }
  const Tag = motion[as];
  return (
    <Tag className={className} variants={VARIANTS[variant]} {...rest}>
      {children}
    </Tag>
  );
}
Reveal.Item = Item;
