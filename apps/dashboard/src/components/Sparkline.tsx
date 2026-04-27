export function Sparkline({ values, accent = false }: { values: number[]; accent?: boolean }) {
  const max = Math.max(1, ...values);
  const w = 80;
  const h = 26;
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${i * stepX},${h - (v / max) * (h - 4) - 2}`);
  const d = `M${points.join(' L')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[26px] w-20">
      <path
        d={d}
        fill="none"
        stroke={accent ? 'var(--accent)' : 'var(--ink)'}
        strokeWidth={accent ? 1.4 : 1.2}
      />
    </svg>
  );
}
