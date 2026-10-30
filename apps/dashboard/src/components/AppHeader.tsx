import { Logo } from './Logo';
import { NavLinks } from './NavLinks';
import { getCoach } from '@/lib/coach';

export function AppHeader() {
  const { waiting } = getCoach();
  return (
    <header className="flex items-center gap-4 border-b border-line px-5 py-3.5 sm:gap-6 sm:px-8">
      <a href="/" className="flex shrink-0 items-center gap-2 text-ink">
        <Logo className="h-5 w-5" />
        <span className="font-display text-[23px] leading-none tracking-[-0.01em]">Trace</span>
      </a>
      <NavLinks waiting={waiting} />
      <a
        href="/search"
        aria-label="Search"
        className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-[140ms] hover:bg-sunk hover:text-ink"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" strokeLinecap="round" />
        </svg>
      </a>
    </header>
  );
}
