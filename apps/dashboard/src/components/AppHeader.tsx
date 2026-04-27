import Link from 'next/link';

export function AppHeader({ active }: { active: 'today' | 'projects' | 'patterns' | 'search' | null }) {
  const link = (key: string, href: string, label: string) => (
    <Link
      key={key}
      href={href}
      className={`rounded px-2 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] transition-colors ${
        active === key ? 'text-ink' : 'text-dim hover:bg-quiet hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );

  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-6 border-b border-rule bg-gradient-to-b from-white/40 to-transparent px-8 py-5">
      <div className="inline-flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.22em] text-ink">
        <span className="inline-block h-3 w-3 rounded-sm bg-accent" />
        TRACE
        <nav className="ml-3 flex gap-1 border-l border-rule pl-3">
          {link('today', '/', 'Today')}
          {link('projects', '/projects', 'Projects')}
          {link('patterns', '/patterns', 'Patterns')}
          {link('search', '/search', 'Search')}
        </nav>
      </div>

      <form action="/search" className="relative mx-auto w-full max-w-[460px]">
        <svg className="absolute left-[13px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-55" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          type="text"
          name="q"
          placeholder="Search every session…"
          className="w-full rounded-full border border-transparent bg-[rgba(26,26,26,0.04)] px-4 py-2.5 pl-9 text-[14.5px] text-ink placeholder:italic placeholder:text-dim focus:border-ink focus:bg-white focus:shadow-[0_4px_16px_-8px_rgba(26,26,26,0.25)] focus:outline-none"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.1em] text-dim">
          ⌘ K
        </span>
      </form>

      <div className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.18em] text-dim">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent breathe align-middle" />
        {date}
      </div>
    </header>
  );
}
