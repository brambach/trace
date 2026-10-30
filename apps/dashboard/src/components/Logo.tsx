// Trace's own mark: three prompts on a line, the last one in red pencil.
export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <line x1="2" x2="18" y1="14" y2="14" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
      <line x1="5" x2="5" y1="14" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9.5" x2="9.5" y1="14" y2="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="14.5" x2="14.5" y1="14" y2="9" stroke="var(--mark)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
