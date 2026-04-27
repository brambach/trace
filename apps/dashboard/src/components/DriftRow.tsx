import { relativeTime } from '@/lib/format';

export function DriftRow({
  id,
  whenIso,
  project,
  reason,
  flag,
}: {
  id: string;
  whenIso: string;
  project: string;
  reason: string;
  flag: 'DRIFT' | 'VAGUE' | 'SHIFTING';
}) {
  return (
    <a
      href={`/sessions/${id}`}
      className="grid grid-cols-[1.4fr_1fr_1.6fr_auto] items-center gap-4 border-b border-rule py-3.5 transition-colors hover:bg-[rgba(160,90,63,0.04)]"
    >
      <span className="font-mono text-[11px] tracking-[0.06em] text-dim">{relativeTime(whenIso)}</span>
      <span className="font-serif text-base">{project}</span>
      <span className="font-serif italic text-sm leading-snug text-[#444]">{reason}</span>
      <span className="rounded-full border border-bad/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bad">
        {flag}
      </span>
    </a>
  );
}
