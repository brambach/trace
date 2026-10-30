import type { Metadata } from 'next';
import { getPatterns } from '@trace/db';
import { db } from '@/lib/db';
import { getCoach } from '@/lib/coach';
import { Masthead, SectionHead } from '@/components/Masthead';
import { LengthHistogram } from '@/components/LengthHistogram';
import { PatternBar } from '@/components/PatternBar';
import { DriftRow } from '@/components/DriftRow';
import { derivePatternsHeadlineDeck } from '@/lib/patterns-derived';
import { weekStartOf } from '@trace/coach';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Patterns' };

const WEEK = 7 * 86_400_000;

export default function PatternsPage() {
  const p = getPatterns(db(), 14);
  const { headline, deck } = derivePatternsHeadlineDeck(p);
  const { timelines, corrections } = getCoach();

  // Corrections per 10 prompts, week by week. Falling means the fixes work.
  const thisWeek = weekStartOf(new Date()).getTime();
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = thisWeek - (5 - i) * WEEK;
    const inWeek = (iso: string) => Date.parse(iso) >= start && Date.parse(iso) < start + WEEK;
    const prompts = timelines.flatMap((t) => t.events).filter((e) => e.kind === 'prompt' && inWeek(e.timestamp)).length;
    const fixes = corrections.filter((c) => inWeek(c.timestamp)).length;
    return { start, prompts, rate: prompts === 0 ? null : (10 * fixes) / prompts };
  });
  const maxRate = Math.max(0.5, ...weeks.map((w) => w.rate ?? 0));
  const via = {
    said: corrections.filter((c) => c.via === 'said').length,
    interrupt: corrections.filter((c) => c.via === 'interrupt').length,
    rejection: corrections.filter((c) => c.via === 'rejection').length,
  };
  const total = Math.max(1, corrections.length);

  return (
    <>
      <Masthead eyebrow="Patterns · last 14 days" headline={headline} deck={deck} />

      <section>
        <SectionHead title="Are you correcting less?" note="Corrections per 10 prompts" />
        <div className="grid h-32 grid-cols-6 gap-3 border-b border-line-strong">
          {weeks.map((w, i) => (
            <div key={w.start} className="relative h-full">
              <div
                className={`absolute inset-x-0 bottom-0 rounded-t-[3px] bg-mark ${i === weeks.length - 1 ? '' : 'opacity-40'}`}
                style={{ height: `${w.rate === null ? 0 : Math.max(2, (w.rate / maxRate) * 80)}%` }}
              />
              {w.rate !== null && (
                <span className="num absolute inset-x-0 text-center text-[12px] text-muted" style={{ bottom: `calc(${Math.max(2, (w.rate / maxRate) * 80)}% + 4px)` }}>
                  {w.rate.toFixed(1)}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-6 gap-3 text-center font-mono text-[11px] text-faint">
          {weeks.map((w, i) => (
            <span key={w.start}>{i === weeks.length - 1 ? 'this week' : new Date(w.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <PatternBar name="You redirected it" pct={Math.round((100 * via.said) / total)} />
          <PatternBar name="You stopped it" pct={Math.round((100 * via.interrupt) / total)} />
          <PatternBar name="You rejected a tool call" pct={Math.round((100 * via.rejection) / total)} />
        </div>
      </section>

      <section className="mt-14">
        <SectionHead title="Prompt length" note={`${p.total_user_prompts} prompts`} />
        <LengthHistogram bins={p.length_histogram} />
        <div className="mt-5 grid grid-cols-3 gap-6">
          <Stat value={String(p.median_word_count)} label="Median words" />
          <Stat value={`${p.share_under_10_words}%`} label="Under 10 words" />
          <Stat value={`${p.one_shot_rate_pct}%`} label="Done in 3 prompts or fewer" />
        </div>
      </section>

      <section className="mt-14">
        <SectionHead title="What your prompts carry" />
        <div className="grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2">
          <PatternBar name="A file path" pct={p.prompt_anatomy.has_file_path_pct} />
          <PatternBar name="A code block" pct={p.prompt_anatomy.has_code_block_pct} />
          <PatternBar name="An error message" pct={p.prompt_anatomy.has_error_message_pct} />
          <PatternBar name="A question" pct={p.prompt_anatomy.is_interrogative_pct} />
        </div>
      </section>

      {p.drifted_sessions.length > 0 && (
        <section className="mt-14">
          <SectionHead title="Sessions that drifted" />
          {p.drifted_sessions.map((s) => (
            <DriftRow key={s.id} id={s.id} title={s.ai_title} whenIso={s.ended_at} project={s.project_name} reason={s.reason} flag={s.flag} />
          ))}
        </section>
      )}

      <p className="mt-14 border-t border-line pt-4 text-[13px] text-muted">Counted from your session files. No model scores anything here.</p>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="num text-[26px] font-medium tracking-[-0.01em] text-ink">{value}</div>
      <div className="text-[13px] text-muted">{label}</div>
    </div>
  );
}
