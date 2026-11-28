import { Link } from 'react-router-dom';

// Uppercase condensed buttons. On hover a second colour sweeps in from the left (sharp, 300ms).
const BASE =
  'group/btn relative isolate inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md ' +
  'font-display font-medium uppercase tracking-[0.14em] select-none cursor-pointer ' +
  'transition-[color,border-color,transform] duration-300 ease-[cubic-bezier(0.7,0,0.2,1)] active:scale-[0.97] ' +
  'before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:transition-transform ' +
  'before:duration-300 before:ease-[cubic-bezier(0.7,0,0.2,1)] hover:before:scale-x-100 ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS = {
  accent: 'bg-accent-500 text-ink before:bg-ink hover:text-white',
  primary: 'bg-brand-700 text-white before:bg-ink',
  outline: 'border-2 border-accent-600 text-accent-700 before:bg-accent-500 hover:text-ink hover:border-accent-500',
  outlineLight: 'border-2 border-white/80 text-white before:bg-white hover:text-ink',
  dark: 'bg-ink text-white before:bg-accent-500 hover:text-ink',
};

const SIZES = {
  sm: 'h-10 px-5 text-xs',
  md: 'h-12 px-7 text-[0.8rem]',
  lg: 'h-14 px-9 text-sm',
};

/** One button system: `to` renders a router Link, `href` an anchor, otherwise a <button>. */
export default function Button({ to, href, variant = 'accent', size = 'md', className = '', children, ...rest }) {
  const cls = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}
