import { searchMessages } from '@trace/db';
import { db } from '@/lib/db';
import { relativeTime } from '@/lib/format';
import { Masthead } from '@/components/Masthead';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const results = query === '' ? [] : searchMessages(db(), query, { limit: 50 });

  const headline = query === '' ? 'Search every session.' : `Results for "${query}"`;
  const deck =
    query === ''
      ? 'Type a phrase in the header search to find anything you ever said to Claude.'
      : `${results.length} match${results.length === 1 ? '' : 'es'} across all sessions.`;

  return (
    <>
      <Masthead eyebrow="Search" headline={headline} deck={deck} />
      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 flex flex-col">
        {results.map((r) => (
          <a
            key={r.message_id}
            href={`/sessions/${r.session_id}`}
            className="block border-b border-rule py-4 transition-colors hover:bg-[rgba(200,155,123,0.06)]"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-serif text-base tracking-[-0.005em]">
                {r.ai_title ?? '(untitled session)'}
              </span>
              <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
                {r.project_name} · {relativeTime(r.timestamp)}
              </span>
            </div>
            <p
              className="mt-2 font-serif italic text-[14.5px] leading-snug text-[#444]"
              dangerouslySetInnerHTML={{ __html: r.snippet }}
            />
          </a>
        ))}
        {query !== '' && results.length === 0 && (
          <p className="py-6 italic text-dim">No matches.</p>
        )}
      </div>
    </>
  );
}
