import { notFound } from 'next/navigation';
import { getSessionDetail } from '@trace/db';
import { db } from '@/lib/db';
import { Masthead } from '@/components/Masthead';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = getSessionDetail(db(), id);
  if (!session) notFound();

  return (
    <>
      <Masthead
        eyebrow={`${session.project_name} · ${formatDate(session.started_at)}`}
        headline={session.ai_title ?? '(untitled session)'}
        deck={`${session.messages.length} message${session.messages.length === 1 ? '' : 's'}.`}
      />
      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 flex flex-col gap-6">
        {session.messages.map((m) => (
          <div key={m.id} className="grid grid-cols-[88px_1fr] items-baseline gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
              {m.role}
            </div>
            <div className={`whitespace-pre-wrap font-serif text-[15.5px] leading-relaxed ${m.role === 'user' ? 'text-ink' : 'text-[#3a3a3a]'}`}>
              {m.content_text}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
