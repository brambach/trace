export function Sparkline({ values, className = 'h-7 w-full' }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values);
  const w = 140;
  const h = 28;
  const bar = w / values.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      {values.map((v, i) => (
        <rect key={i} x={i * bar + bar * 0.22} y={h - Math.max(v > 0 ? 2 : 0.6, (v / max) * h)} width={bar * 0.56} height={Math.max(v > 0 ? 2 : 0.6, (v / max) * h)} rx={1} fill={v > 0 ? 'var(--ink)' : 'var(--line-strong)'} opacity={v > 0 ? 0.8 : 1} />
      ))}
    </svg>
  );
}
