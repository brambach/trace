export function PatternBar({ name, pct }: { name: string; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] text-ink">{name}</span>
        <span className="num text-[15px] text-ink-2">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunk">
        <div className="h-full rounded-full bg-ink opacity-80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
