import type { SessionTimeline } from '@trace/shared';
import { Strip } from './Strip';
import { AgentMark } from './AgentMark';
import { compressedScale, marksFor } from '@/lib/marks';
import { formatTime, minutesBetween, plural, relativeTime } from '@/lib/format';

export function SessionRow({
  session,
  corrections,
  showProject = true,
  when = 'time',
}: {
  session: SessionTimeline;
  corrections: Set<string>;
  showProject?: boolean;
  when?: 'time' | 'relative';
}) {
  const marks = marksFor(session, corrections);
  const fixes = marks.filter((m) => m.kind === 'correction').length;
  const prompts = marks.filter((m) => m.kind !== 'tool').length;
  return (
    <a
      href={`/sessions/${encodeURIComponent(session.id)}`}
      className="group -mx-3 grid grid-cols-1 gap-x-8 gap-y-2 rounded-[10px] px-3 py-4 transition-colors duration-[140ms] hover:bg-sunk sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)] sm:items-center"
    >
      <div className="min-w-0">
        <div className="truncate text-[16px] font-medium text-ink">{session.ai_title ?? 'Untitled session'}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <AgentMark agent={session.agent} className="h-3 w-3" />
          {showProject && <span className="text-ink-2">{session.project_name}</span>}
          {showProject && <span aria-hidden>·</span>}
          <span className="num">{when === 'time' ? formatTime(session.started_at) : relativeTime(session.ended_at)}</span>
          <span aria-hidden>·</span>
          <span className="num">{minutesBetween(session.started_at, session.ended_at)} min</span>
          <span aria-hidden>·</span>
          <span className="num">{plural(prompts, 'prompt')}</span>
          {fixes > 0 && (
            <span className="num font-medium text-mark">
              {plural(fixes, 'correction')}
            </span>
          )}
        </div>
      </div>
      <Strip marks={marks} x={compressedScale(marks.map((m) => m.t))} height={40} />
    </a>
  );
}
