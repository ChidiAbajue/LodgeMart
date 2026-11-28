import Reveal from './Reveal';

/** Titled block used across the vendor / rider / admin portals. */
export default function PortalSection({ kicker, title, icon: Icon, aside, children, className = '' }) {
  return (
    <Reveal as="section" className={className}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          {kicker && (
            <p className="font-display text-xs font-medium uppercase tracking-[0.25em] text-accent-700">{kicker}</p>
          )}
          <h2 className="mt-1.5 flex items-center gap-2.5 font-display text-3xl font-semibold uppercase leading-none text-ink">
            {Icon && <Icon className="h-6 w-6 text-accent-600" strokeWidth={2} />}
            {title}
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </Reveal>
  );
}
