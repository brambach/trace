type Variant = 'default' | 'thread' | 'stalled' | 'new';

export function Pill({ variant = 'default', children }: { variant?: Variant; children: React.ReactNode }) {
  const cls = {
    default: 'border-rule text-ink',
    thread: 'border-accent text-[#8c5a38] bg-[rgba(200,155,123,0.10)]',
    stalled: 'border-rule text-dim',
    new: 'border-accent text-accent',
  }[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] ${cls}`}
    >
      {variant === 'thread' && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      {children}
    </span>
  );
}
