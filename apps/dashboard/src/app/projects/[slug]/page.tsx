import { notFound } from 'next/navigation';
import { getProjectDetail } from '@trace/db';
import { db } from '@/lib/db';
import { Masthead } from '@/components/Masthead';
import { Pill } from '@/components/Pill';
import { relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const projectName = decodeURIComponent(slug);
  const detail = getProjectDetail(db(), projectName);
  if (!detail) notFound();

  return (
    <>
      <Masthead
        eyebrow="Project"
        headline={detail.project_name}
        deck={detail.current_focus ?? 'No focus generated yet.'}
      />
      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 mb-7 flex items-baseline gap-4 font-mono text-[11.5px] tracking-[0.04em] text-dim">
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{detail.total_sessions}</strong> sessions
        </span>
        <span className="h-3.5 w-px bg-rule" />
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{detail.total_messages}</strong> messages
        </span>
        <span className="h-3.5 w-px bg-rule" />
        <span>last touched {relativeTime(detail.last_touched)}</span>
      </div>

      <h2 className="reveal r5 mb-3 font-serif text-[22px] font-normal tracking-[-0.01em]">Sessions</h2>
      <div className="reveal r6 flex flex-col">
        {detail.sessions.length === 0 && (
          <p className="py-6 italic text-dim">No sessions yet.</p>
        )}
        {detail.sessions.map((s) => (
          <a
            key={s.id}
            href={`/sessions/${s.id}`}
            className="block border-b border-rule py-5 transition-colors hover:bg-[rgba(200,155,123,0.06)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-serif text-[18px] tracking-[-0.01em]">
                {s.ai_title ?? '(untitled session)'}
              </span>
              {s.ended_without_assistant_reply && <Pill variant="thread">OPEN THREAD</Pill>}
            </div>
            <p className="mt-1 font-serif italic text-[14.5px] leading-snug text-[#444]">
              {s.first_user_message ?? ''}
            </p>
            <div className="mt-2 flex items-baseline gap-3 font-mono text-[10.5px] tracking-[0.06em] text-dim">
              <span>{relativeTime(s.ended_at)}</span>
              <span>·</span>
              <span>
                <strong className="font-serif text-base text-ink serif-numerals">{s.message_count}</strong> msg
              </span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
