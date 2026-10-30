import { Inline } from './Inline';
import type { FixView } from '@/lib/coach';
import { plural } from '@/lib/format';

export function FixTeaser({ views }: { views: FixView[] }) {
  const top = views[0]!.fix;
  return (
    <a
      href="/fixes"
      className="group mb-12 block rounded-[14px] bg-raised p-5 shadow-float transition-transform duration-[220ms] ease-out hover:-translate-y-0.5 sm:p-6"
    >
      <div className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-mark">
        {plural(views.length, 'fix', 'fixes')} drafted
      </div>
      <p className="mt-2 font-display text-[26px] leading-[1.15] tracking-[-0.01em]">
        You&apos;ve told the agent to &ldquo;<Inline text={top.said} codeClass="font-display" />&rdquo; {top.times} times.
      </p>
      <p className="mt-2 max-w-[56ch] text-ink-2">
        Trace wrote it into a line for {top.target.scope === 'global' ? 'your global CLAUDE.md' : `${top.projects[0]}'s CLAUDE.md`}, so you can stop saying it.
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-ink">
        Review {views.length === 1 ? 'it' : `all ${views.length}`}
        <span className="transition-transform duration-[220ms] ease-out group-hover:translate-x-0.5" aria-hidden>→</span>
      </span>
    </a>
  );
}
