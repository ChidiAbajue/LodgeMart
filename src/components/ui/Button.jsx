import { Link } from 'react-router-dom';

// Hard-edge buttons: 2px ink border + offset ink shadow. Hover lifts, press sinks into the shadow.
const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold rounded-full select-none cursor-pointer ' +
  'border-2 border-ink transition-[transform,box-shadow,background-color] duration-150 ease-out ' +
  'shadow-[4px_4px_0_0_var(--color-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_var(--color-ink)] ' +
  'active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0_0_0_0_var(--color-ink)] ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-600',
  accent: 'bg-accent-500 text-ink hover:bg-accent-400',
  secondary: 'bg-white text-ink hover:bg-cream',
  onDark: 'bg-cream text-ink hover:bg-white',
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
