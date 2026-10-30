// Renders `code` spans inside plain text you or the agent wrote.
export function Inline({ text, codeClass = 'rounded-[4px] bg-sunk px-1 py-px font-mono text-[0.86em] text-ink-2' }: { text: string; codeClass?: string }) {
  const parts = text.split('`');
  if (parts.length < 3) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 && i < parts.length - 1 ? (
          <code key={i} className={codeClass}>{p}</code>
        ) : (
          <span key={i}>{i % 2 === 1 ? `\`${p}` : p}</span>
        ),
      )}
    </>
  );
}
