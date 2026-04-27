import { getProjectCards } from '@trace/db';
import { db } from '@/lib/db';
import { Sparkline } from '@/components/Sparkline';
import { Pill } from '@/components/Pill';
import { Masthead } from '@/components/Masthead';
import { relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  const cards = getProjectCards(db(), 14);
  return (
    <>
      <Masthead
        eyebrow="Projects"
        headline="Everything you&apos;re building, side by side."
        deck={`${cards.length} project${cards.length === 1 ? '' : 's'} touched. Sorted by last activity.`}
      />
      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 grid grid-cols-1 gap-5 md:grid-cols-2">
        {cards.length === 0 && (
          <p className="col-span-2 py-6 italic text-dim">No projects yet.</p>
        )}
        {cards.map((c, i) => (
          <a
            key={c.project_name}
            href={`/projects/${encodeURIComponent(c.project_name)}`}
            className="group flex flex-col gap-3 border border-rule bg-paper/60 p-5 transition-colors hover:bg-paper"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-serif text-[22px] tracking-[-0.012em]">{c.project_name}</span>
              {c.open_thread && <Pill variant="thread">OPEN</Pill>}
              {c.stalled_days >= 7 && !c.open_thread && (
                <Pill variant="stalled">STALLED · {c.stalled_days}d</Pill>
              )}
            </div>
            <p className={`font-serif italic text-[14.5px] leading-snug ${c.current_focus ? 'text-[#444]' : 'text-dim'}`}>
              {c.current_focus ?? 'No focus yet.'}
            </p>
            <div className="flex items-baseline justify-between gap-3 font-mono text-[10.5px] tracking-[0.06em] text-dim">
              <span>
                <strong className="font-serif text-base text-ink serif-numerals">{c.total_sessions}</strong> sessions ·{' '}
                <strong className="font-serif text-base text-ink serif-numerals">{c.total_messages}</strong> msg
              </span>
              <span>{relativeTime(c.last_touched)}</span>
            </div>
            <Sparkline values={c.spark} accent={i === 0} />
          </a>
        ))}
      </div>
    </>
  );
}
