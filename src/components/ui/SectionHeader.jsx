import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function SectionHeader({ title, kicker, action, id }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        {kicker && <p className="text-sm font-semibold text-accent-700 mb-1.5">{kicker}</p>}
        <h2 id={id} className="text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] text-ink">
          {title}
        </h2>
      </div>
      {action && (
        <Link
          to={action.to}
          className="group shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-line bg-white text-sm font-semibold text-ink transition-colors hover:border-ink/25"
        >
          {action.label}
          <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
