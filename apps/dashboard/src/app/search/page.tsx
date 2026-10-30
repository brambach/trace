import type { Metadata } from 'next';
import { searchMessages } from '@trace/db';
import { db } from '@/lib/db';
import { relativeTime } from '@/lib/format';
import { Masthead } from '@/components/Masthead';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const results = query === '' ? [] : searchMessages(db(), query, { limit: 50 });

  return (
    <>
      <Masthead
        eyebrow="Search"
        headline={query === '' ? 'Find anything you said.' : `“${query}”`}
        deck={query === '' ? 'Every prompt and reply, across every project and agent.' : `${results.length === 50 ? '50+' : results.length} match${results.length === 1 ? '' : 'es'}.`}
      />
      <form action="/search" className="relative mb-8">
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoFocus={query === ''}
          placeholder="pnpm, the auth bug, force push…"
          className="w-full rounded-full bg-sunk px-5 py-3 text-[16px] text-ink placeholder:text-faint focus:bg-raised focus:shadow-float focus:outline-none"
        />
      </form>
      <div className="flex flex-col">
        {results.map((r) => (
          <a
            key={r.message_id}
            href={`/sessions/${encodeURIComponent(r.session_id)}?at=${encodeURIComponent(r.message_id)}`}
            className="-mx-3 block rounded-[10px] px-3 py-4 transition-colors duration-[140ms] hover:bg-sunk"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="text-[15.5px] font-medium">{r.ai_title ?? 'Untitled session'}</span>
              <span className="text-[13px] text-muted">{r.project_name} · {relativeTime(r.timestamp)}</span>
            </div>
            <p className="mt-1.5 text-[14.5px] leading-[1.55] text-ink-2" dangerouslySetInnerHTML={{ __html: r.snippet }} />
          </a>
        ))}
        {query !== '' && results.length === 0 && <p className="py-6 text-muted">Nothing matches.</p>}
      </div>
    </>
  );
}
