export function AmbientChart({ values }: { values: number[] }) {
  const w = 600;
  const h = 40;
  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * stepX, h - (v / max) * (h - 6) - 2] as const);
  const path = `M${pts.map((p) => `${p[0]},${p[1]}`).join(' L')}`;
  const area = `${path} L${w},${h} L0,${h} Z`;
  const today = pts[pts.length - 1];
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <div className="mt-9 grid grid-cols-[auto_1fr_auto] items-center gap-6 border-t border-rule pt-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-dim">14 days · ambient</span>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full">
        <path d={area} fill="var(--accent)" opacity={0.15} />
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1} opacity={0.7} />
        {today && (
          <circle
            cx={today[0]}
            cy={today[1]}
            r={2.5}
            fill="var(--accent)"
            stroke="var(--ink)"
            strokeWidth={1}
            className="breathe-today"
          />
        )}
      </svg>
      <span className="whitespace-nowrap font-serif text-sm text-dim">
        <strong className="text-ink serif-numerals">{total.toLocaleString()}</strong> msg / 14d
      </span>
    </div>
  );
}
