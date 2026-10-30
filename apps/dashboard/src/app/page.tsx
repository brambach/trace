import { Masthead, SectionHead } from '@/components/Masthead';
import { SessionRow } from '@/components/SessionRow';
import { Strip } from '@/components/Strip';
import { FixTeaser } from '@/components/FixTeaser';
import { getCoach } from '@/lib/coach';
import { linearScale, marksFor } from '@/lib/marks';
import { formatDay, formatTime, plural, spell, todayIso } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function Today() {
  const { timelines, corrections, views } = getCoach();
  const correctionIds = new Set(corrections.map((c) => c.messageId));
  const today = todayIso();
  const todays = timelines.filter((t) => t.ended_at.slice(0, 10) === today).reverse();
  const recent = todays.length > 0 ? todays : [...timelines].reverse().slice(0, 6);

  const marks = todays.flatMap((s) => marksFor(s, correctionIds));
  const prompts = marks.filter((m) => m.kind !== 'tool').length;
  const corrected = marks.filter((m) => m.kind === 'correction').length;
  const projects = new Set(todays.map((t) => t.project_name)).size;
  const first = todays.at(-1)?.started_at;
  const t0 = first ? Date.parse(first) - 20 * 60_000 : 0;
  const t1 = Date.now();

  const headline =
    todays.length === 0
      ? 'Quiet day so far.'
      : corrected === 0
        ? 'Nothing to correct today.'
        : `You corrected the agent ${corrected === 1 ? 'once' : `${spell(corrected)} times`} today.`;
  const deck =
    todays.length === 0
      ? 'Run Claude Code or Codex in any project and today fills in as you work.'
      : `${plural(prompts, 'prompt')} across ${plural(todays.length, 'session')} in ${plural(projects, 'project')}.`;

  const waiting = views.filter((v) => v.state === 'waiting');

  return (
    <>
      <Masthead eyebrow={formatDay(`${today}T12:00:00Z`)} headline={headline} deck={deck} />

      {todays.length > 0 && (
        <section className="mb-12" aria-label="Today as a strip">
          <Strip marks={marks} x={linearScale(t0, t1)} height={88} label={`${prompts} prompts today, ${corrected} corrections`} />
          <div className="mt-1 flex justify-between font-mono text-[11.5px] text-faint">
            <span className="num">{formatTime(new Date(t0).toISOString())}</span>
            <span>now</span>
          </div>
          <Legend />
        </section>
      )}

      {waiting.length > 0 && <FixTeaser views={waiting} />}

      <section>
        <SectionHead title={todays.length > 0 ? 'Sessions today' : 'Latest sessions'} note={todays.length > 0 ? undefined : 'Nothing today yet'} />
        <div className="flex flex-col">
          {recent.map((s) => (
            <SessionRow key={s.id} session={s} corrections={correctionIds} when={todays.length > 0 ? 'time' : 'relative'} />
          ))}
          {recent.length === 0 && (
            <p className="py-6 text-muted">No sessions yet. Trace reads ~/.claude/projects and ~/.codex/sessions as you work.</p>
          )}
        </div>
      </section>
    </>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-muted">
      <span className="flex items-center gap-2">
        <svg width="8" height="14" aria-hidden><line x1="4" x2="4" y1="13" y2="2" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" /></svg>
        A prompt, as tall as it was long
      </span>
      <span className="flex items-center gap-2">
        <svg width="12" height="16" aria-hidden>
          <line x1="6" x2="6" y1="9" y2="1" stroke="var(--mark)" strokeWidth="2" strokeLinecap="round" />
          <path d="M2,16 L6,11 L10,16" fill="none" stroke="var(--mark)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        A correction
      </span>
      <span className="flex items-center gap-2">
        <svg width="14" height="8" aria-hidden>
          {[2, 5, 7, 11].map((x) => <line key={x} x1={x} x2={x} y1="1" y2="7" stroke="var(--faint)" strokeWidth="1" />)}
        </svg>
        The agent at work
      </span>
    </div>
  );
}
