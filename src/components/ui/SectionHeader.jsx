import Reveal from './Reveal';

/** Kicker + big condensed heading (+ optional lede). Centered by default, like a menu board. */
export default function SectionHeader({ kicker, title, lede, id, align = 'center', tone = 'light', action }) {
  const center = align === 'center';
  const dark = tone === 'dark';
  return (
    <Reveal
      stagger={0.08}
      className={`mb-10 sm:mb-14 flex flex-col gap-4 ${center ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'}`}
    >
      <div className={center ? 'max-w-2xl' : 'max-w-xl'}>
        {kicker && (
          <Reveal.Item
            as="p"
            className={`font-display text-xs font-medium uppercase tracking-[0.25em] ${dark ? 'text-accent-400' : 'text-accent-700'}`}
          >
            {kicker}
          </Reveal.Item>
        )}
        <Reveal.Item
          as="h2"
          id={id}
          className={`mt-3 font-display text-4xl sm:text-5xl lg:text-6xl font-semibold uppercase leading-[1.02] tracking-[-0.01em] ${dark ? 'text-white' : 'text-ink'}`}
        >
          {title}
        </Reveal.Item>
        {lede && (
          <Reveal.Item as="p" className={`mt-4 text-base sm:text-lg leading-relaxed ${dark ? 'text-white/70' : 'text-muted'}`}>
            {lede}
          </Reveal.Item>
        )}
      </div>
      {action && <Reveal.Item>{action}</Reveal.Item>}
    </Reveal>
  );
}
