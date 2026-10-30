import type { Metadata } from 'next';
import { Strip } from '@/components/Strip';
import { SessionRow } from '@/components/SessionRow';
import { Inline } from '@/components/Inline';
import { getCoach, displayPath } from '@/lib/coach';
import { letterFor } from '@/lib/letter';
import { linearScale, marksFor } from '@/lib/marks';
import { plural } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Letter' };

const DAY = 86_400_000;
const HOUR = 3_600_000;

function shortDate(date: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
}

export default async function LetterPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const letter = letterFor(week);
  const { corrections } = getCoach();
  const correctionIds = new Set(corrections.map((c) => c.messageId));

  // One hour axis for every day, so the seven strips line up.
  const all = letter.days.flatMap((d) => d.sessions.flatMap((s) => marksFor(s, correctionIds).map((m) => ({ m, date: d.date }))));
  const hourOf = (t: number) => (t % DAY) / HOUR;
  const h0 = all.length ? Math.max(0, Math.floor(Math.min(...all.map((a) => hourOf(a.m.t)))) - 1) : 8;
  const h1 = all.length ? Math.min(24, Math.ceil(Math.max(...all.map((a) => hourOf(a.m.t)))) + 1) : 22;

  const prev = new Date(Date.parse(`${letter.weekStart}T00:00:00Z`) - 7 * DAY).toISOString().slice(0, 10);
  const next = new Date(Date.parse(`${letter.weekStart}T00:00:00Z`) + 7 * DAY);
  const hasNext = next.getTime() <= Date.now();
  const range = `${shortDate(letter.weekStart, { month: 'short', day: 'numeric' })} to ${shortDate(letter.weekEnd, { month: 'short', day: 'numeric' })}`;

  return (
    <article className="mx-auto max-w-[720px]">
      <div className="flex items-center justify-between border-b-2 border-ink pb-2 font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted">
        <span>The Trace Letter · No. {letter.issue}</span>
        <span className="num">{range}</span>
      </div>

      <h1 className="mt-8 text-balance font-display text-[40px] leading-[1.05] tracking-[-0.012em] sm:text-[54px]">
        <Inline text={letter.headline} codeClass="rounded-[6px] bg-sunk px-1.5 font-mono text-[0.62em] tracking-normal align-[0.12em]" />
      </h1>
      <p className="mt-4 text-[17px] leading-[1.55] text-ink-2">{letter.deck}</p>

      <section className="mt-12" aria-label="The week, day by day">
        <h2 className="mb-4 font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted">The week</h2>
        <div className="flex flex-col">
          {letter.days.map((d) => {
            const t0 = Date.parse(`${d.date}T00:00:00Z`);
            const marks = d.sessions.flatMap((s) => marksFor(s, correctionIds));
            const future = t0 > Date.now();
            return (
              <div key={d.date} className="grid grid-cols-[44px_minmax(0,1fr)] items-end gap-3 border-b border-line last:border-b-0">
                <span className={`pb-3 font-mono text-[12px] ${future ? 'text-faint' : 'text-muted'}`}>{shortDate(d.date, { weekday: 'short' })}</span>
                {marks.length > 0 ? (
                  <Strip marks={marks} x={linearScale(t0 + h0 * HOUR, t0 + h1 * HOUR)} height={46} />
                ) : (
                  <div className="h-[46px]" />
                )}
              </div>
            );
          })}
        </div>
        <div className="ml-[56px] mt-1 flex justify-between font-mono text-[11px] text-faint">
          <span className="num">{fmtHour(h0)}</span>
          <span className="num">{fmtHour(h1)}</span>
        </div>
      </section>

      {letter.habit && (
        <section className="mt-14">
          <h2 className="font-display text-[30px] leading-tight tracking-[-0.01em]">The habit that cost the most</h2>
          <div className="mt-4 flex flex-col gap-3">
            {letter.habit.fix.evidence
              .filter((e) => e.timestamp >= letter.weekStart)
              .slice(-3)
              .map((e) => (
                <blockquote key={e.messageId} className="border-l-2 border-mark pl-4 text-[16px] leading-[1.55]">
                  <Inline text={e.quote} />
                  <footer className="mt-1 text-[13px] text-muted">{e.project_name}{e.did ? <>, after it <Inline text={e.did} /></> : null}</footer>
                </blockquote>
              ))}
          </div>
          <div className="mt-6 rounded-[14px] bg-raised p-5 shadow-float">
            <div className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted">Trace drafted · {displayPath(letter.habit.fix.target.path)}</div>
            <p className="mt-2 text-[16px] text-ink"><Inline text={letter.habit.fix.line} /></p>
            <a href={`/fixes#fix-${letter.habit.fix.id}`} className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-[14px] font-medium text-on-primary">
              Review the fix
            </a>
          </div>
        </section>
      )}

      {letter.shipped.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-[30px] leading-tight tracking-[-0.01em]">What you worked on</h2>
          <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
            {letter.shipped.map((p) => (
              <div key={p.project}>
                <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                  <a href={`/projects/${encodeURIComponent(p.project)}`} className="text-[16px] font-medium text-ink hover:underline">{p.project}</a>
                  <span className="num text-[13px] text-muted">{plural(p.sessions.length, 'session')}</span>
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {p.sessions.map((s) => (
                    <li key={s.id}>
                      <a href={`/sessions/${encodeURIComponent(s.id)}`} className="text-[14.5px] text-ink-2 hover:text-ink">
                        {s.ai_title ?? 'Untitled session'}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {letter.sideways.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-[30px] leading-tight tracking-[-0.01em]">Where it went sideways</h2>
          <div className="mt-3 flex flex-col">
            {letter.sideways.map((s) => (
              <SessionRow key={s.session.id} session={s.session} corrections={correctionIds} when="relative" />
            ))}
          </div>
        </section>
      )}

      {letter.held.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-[30px] leading-tight tracking-[-0.01em]">What held</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {letter.held.map((f) => (
              <li key={f.id} className="flex items-baseline gap-2.5 text-[15.5px]">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-held" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 8.5l3.2 3L13 4.5" />
                </svg>
                <span><Inline text={f.line} /> <span className="text-muted">You haven&apos;t had to say it since.</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink pt-4 text-[13px] text-muted">
        <span>Counted from your session files. Nothing here was written by a model.</span>
        <span className="flex gap-4">
          <a href={`/letter?week=${prev}`} className="hover:text-ink">← Last week</a>
          {hasNext && <a href={`/letter?week=${next.toISOString().slice(0, 10)}`} className="hover:text-ink">Next week →</a>}
          <a href={`/letter/md?week=${letter.weekStart}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4">Markdown</a>
        </span>
      </footer>
    </article>
  );
}

function fmtHour(h: number): string {
  if (h === 0 || h === 24) return '12 am';
  if (h === 12) return 'noon';
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}
