export function Reveal({
  delay = 1,
  className = '',
  children,
}: {
  delay?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`reveal r${delay} ${className}`}>{children}</div>;
}
