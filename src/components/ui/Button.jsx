import { Link } from 'react-router-dom';

// Soft, lit buttons: pill shape, inner highlight, coloured glow that grows on hover, gentle press.
const BASE =
  'group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold rounded-full select-none cursor-pointer ' +
  'transition-[transform,box-shadow,background-color,border-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ' +
  'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS = {
  primary:
    'bg-brand-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_30px_-10px_rgb(20_78_47/0.8)] hover:bg-brand-600',
  accent:
    'bg-gradient-to-b from-accent-400 to-accent-500 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_12px_36px_-10px_rgb(242_135_36/0.75)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_18px_48px_-10px_rgb(242_135_36/0.95)]',
  secondary: 'bg-white text-ink border border-line hover:border-ink/25 shadow-card',
  onDark:
    'bg-white/[0.07] text-cream border border-white/15 backdrop-blur-md hover:bg-white/[0.12] hover:border-white/30',
};

const SIZES = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-12 px-6 text-[0.95rem]',
  lg: 'h-14 px-7 text-base',
};

/** One button system: `to` renders a router Link, `href` an anchor, otherwise a <button>. */
export default function Button({ to, href, variant = 'primary', size = 'md', className = '', children, ...rest }) {
  const cls = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}
