export function Masthead({
  eyebrow,
  headline,
  deck,
  children,
}: {
  eyebrow: string;
  headline: string;
  deck?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-10">
      <div className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted">{eyebrow}</div>
      <h1 className="max-w-[24ch] text-balance font-display text-[38px] leading-[1.06] tracking-[-0.012em] sm:text-[48px]">{headline}</h1>
      {deck && <p className="mt-4 max-w-[58ch] text-[16px] leading-[1.55] text-ink-2">{deck}</p>}
      {children}
    </header>
  );
}

export function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="font-display text-[26px] leading-tight tracking-[-0.01em]">{title}</h2>
      {note && <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted">{note}</span>}
    </div>
  );
}
