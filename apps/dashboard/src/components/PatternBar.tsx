export function PatternBar({
  name,
  pct,
  delta,
  emphasis = false,
}: {
  name: string;
  pct: number;
  delta?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-2">
      <span className="font-serif text-[15.5px]">{name}</span>
      <span className="font-serif text-base tracking-[-0.01em] serif-numerals">{pct}%</span>
      <div className="col-span-2 mt-1 h-1 overflow-hidden rounded-[2px] bg-quiet">
        <div className={`h-full ${emphasis ? 'bg-accent' : 'bg-ink'}`} style={{ width: `${pct}%` }} />
      </div>
      {delta && <span className="col-span-2 font-mono text-[10.5px] tracking-[0.04em] text-dim">{delta}</span>}
    </div>
  );
}
