export function Masthead({
  eyebrow,
  headline,
  deck,
}: {
  eyebrow: string;
  headline: string;
  deck?: string;
}) {
  return (
    <>
      <div className="reveal r1 eyebrow mb-1.5">{eyebrow}</div>
      <h1 className="reveal r2 headline mb-3 max-w-[22ch]">{headline}</h1>
      {deck && <p className="reveal r2 deck mb-5 max-w-[56ch]">{deck}</p>}
    </>
  );
}
