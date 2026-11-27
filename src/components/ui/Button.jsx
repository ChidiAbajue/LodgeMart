import { Link } from 'react-router-dom';

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold rounded-full select-none cursor-pointer ' +
  'transition-[transform,background-color,box-shadow,color] duration-150 ease-out ' +
  'hover:-translate-y-px active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-[0_6px_16px_-8px_rgb(20_78_47/0.7)]',
  secondary: 'bg-white text-ink border border-line hover:border-ink/25',
  accent: 'bg-accent-500 text-ink hover:bg-accent-400',
  onDark: 'bg-white text-brand-800 hover:bg-brand-50',
};

const SIZES = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-13 px-7 text-base',
};

/** One button system: `to` renders a router Link, `href` an anchor, otherwise a <button>. */
export default function Button({ to, href, variant = 'primary', size = 'md', className = '', children, ...rest }) {
  const cls = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}
