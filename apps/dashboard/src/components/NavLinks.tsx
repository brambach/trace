'use client';

import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Today' },
  { href: '/fixes', label: 'Fixes' },
  { href: '/letter', label: 'Letter' },
  { href: '/projects', label: 'Projects' },
  { href: '/patterns', label: 'Patterns' },
] as const;

export function NavLinks({ waiting }: { waiting: number }) {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <nav className="no-scrollbar -my-1 flex min-w-0 gap-0.5 overflow-x-auto py-1">
      {LINKS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? 'page' : undefined}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] transition-colors duration-[140ms] ${
            active(l.href) ? 'bg-sunk text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {l.label}
          {l.href === '/fixes' && waiting > 0 && (
            <span className="num rounded-full bg-mark px-1.5 text-[11px] font-medium leading-[17px] text-on-primary">{waiting}</span>
          )}
        </a>
      ))}
    </nav>
  );
}
