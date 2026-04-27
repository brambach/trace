export function LengthHistogram({ bins }: { bins: number[] }) {
  const max = Math.max(1, ...bins);
  const medianBinIndex = pickMedianBinIndex(bins);
  return (
    <>
      <div className="grid h-24 items-end gap-[3px] border-b border-rule pb-1" style={{ gridTemplateColumns: `repeat(${bins.length}, 1fr)` }}>
        {bins.map((n, i) => (
          <div
            key={i}
            className={`rounded-[1px] ${i === medianBinIndex || i === medianBinIndex - 1 || i === medianBinIndex + 1 ? 'bg-accent opacity-100' : 'bg-ink/85'}`}
            style={{ height: `${(n / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">
        <span>1 word</span>
        <span>median</span>
        <span>200+</span>
      </div>
    </>
  );
}

function pickMedianBinIndex(bins: number[]): number {
  const total = bins.reduce((a, b) => a + b, 0);
  if (total === 0) return -1;
  let acc = 0;
  for (let i = 0; i < bins.length; i++) {
    acc += bins[i] ?? 0;
    if (acc >= total / 2) return i;
  }
  return bins.length - 1;
}
