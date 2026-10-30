import { relativeTime } from '@/lib/format';

const LABEL = { DRIFT: 'Kept redirecting', VAGUE: 'Short prompts, many turns', SHIFTING: 'Changed course' } as const;

export function DriftRow({ id, title, whenIso, project, reason, flag }: { id: string; title: string | null; whenIso: string; project: string; reason: string; flag: keyof typeof LABEL }) {
  return (
    <a href={`/sessions/${encodeURIComponent(id)}`} className="-mx-3 block rounded-[10px] px-3 py-3.5 transition-colors duration-[140ms] hover:bg-sunk">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="text-[15.5px] font-medium">{title ?? 'Untitled session'}</span>
        <span className="text-[13px] text-muted">{project} · {relativeTime(whenIso)}</span>
      </div>
      <div className="mt-1 text-[13.5px] text-ink-2">
        <span className="font-medium">{LABEL[flag]}.</span> {reason}
      </div>
    </a>
  );
}
