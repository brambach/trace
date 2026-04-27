import { Sparkline } from './Sparkline';
import { Pill } from './Pill';
import { relativeTime } from '@/lib/format';

export interface ProjectRowProps {
  name: string;
  cwd: string;
  sessionCount: number;
  messageCount: number;
  aiTitle: string | null;
  openThread: boolean;
  lastTouched: string;
  spark: number[];
  primary?: boolean;
}

export function ProjectRow(props: ProjectRowProps) {
  const { name, sessionCount, messageCount, aiTitle, openThread, lastTouched, spark, primary } = props;
  return (
    <a
      href={`/projects/${encodeURIComponent(name)}`}
      className="relative grid cursor-pointer grid-cols-[1.5fr_1.4fr_100px_80px] items-center gap-5 border-b border-rule py-5 transition-colors hover:bg-[rgba(200,155,123,0.06)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-4 top-4 bottom-4 w-0.5 origin-top scale-y-0 bg-accent transition-transform [a:hover>&]:scale-y-100"
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-[22px] tracking-[-0.012em] leading-tight">{name}</span>
        <span className="flex flex-wrap items-center gap-2.5 font-mono text-[10.5px] tracking-[0.06em] text-dim">
          <span>{relativeTime(lastTouched)}</span>
          {sessionCount > 0 && <Pill>{sessionCount} {sessionCount === 1 ? 'SESSION' : 'SESSIONS'}</Pill>}
          {openThread && <Pill variant="thread">OPEN THREAD</Pill>}
          {sessionCount === 0 && <Pill variant="stalled">QUIET</Pill>}
        </span>
      </div>
      <div className={`italic text-[15px] leading-snug ${aiTitle ? 'text-[#444]' : 'text-dim'}`}>
        {aiTitle ?? 'No AI-generated title yet.'}
      </div>
      <div className="text-right font-mono text-[10.5px] leading-relaxed tracking-[0.06em] text-dim">
        <strong className="serif-numerals block font-serif text-base font-normal tracking-[-0.01em] text-ink">
          {messageCount}
        </strong>
        msg
      </div>
      <Sparkline values={spark} accent={primary} />
    </a>
  );
}
