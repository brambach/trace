export function LengthHistogram({ bins }: { bins: number[] }) {
  const max = Math.max(1, ...bins);
  return (
    <>
      <div className="grid h-24 gap-[3px] border-b border-line-strong" style={{ gridTemplateColumns: `repeat(${bins.length}, 1fr)` }}>
        {bins.map((n, i) => (
          <div key={i} className="relative h-full" title={`${i * 10 + 1} to ${i * 10 + 10} words: ${n}`}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-[2px] bg-ink opacity-80" style={{ height: `${Math.max(n > 0 ? 3 : 0, (n / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-faint">
        <span>1 word</span>
        <span>100</span>
        <span>200+</span>
      </div>
    </>
  );
}
