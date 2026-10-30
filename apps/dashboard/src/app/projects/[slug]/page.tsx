import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Masthead, SectionHead } from '@/components/Masthead';
import { SessionRow } from '@/components/SessionRow';
import { Inline } from '@/components/Inline';
import { getCoach, displayPath } from '@/lib/coach';
import { plural, relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).slug) };
}

export default async function ProjectPage({ params }: Props) {
  const name = decodeURIComponent((await params).slug);
  const { timelines, corrections, views } = getCoach();
  const sessions = timelines.filter((t) => t.project_name === name).reverse();
  if (sessions.length === 0) notFound();
  const correctionIds = new Set(corrections.map((c) => c.messageId));
  const corrected = corrections.filter((c) => c.project_name === name).length;
  const fixes = views.filter((v) => v.fix.projects.includes(name) && v.state !== 'dismissed');

  return (
    <>
      <Masthead
        eyebrow={`Project · ${displayPath(sessions[0]!.cwd)}`}
        headline={name}
        deck={`${plural(sessions.length, 'session')} in the last 60 days, the latest ${relativeTime(sessions[0]!.ended_at)}. You corrected the agent ${plural(corrected, 'time')}.`}
      />
      {fixes.length > 0 && (
        <section className="mb-12">
          <SectionHead title="Fixes" />
          <ul className="flex flex-col gap-2">
            {fixes.map((v) => (
              <li key={v.fix.id}>
                <a href={`/fixes#fix-${v.fix.id}`} className="flex flex-wrap items-baseline gap-x-3 text-[15px] hover:underline">
                  <span className={v.state === 'waiting' ? 'text-mark' : 'text-held'}>{v.state === 'waiting' ? 'Drafted' : v.state === 'applied' ? 'Applied' : 'Written down'}</span>
                  <span className="text-ink"><Inline text={v.fix.line} /></span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SectionHead title="Sessions" />
      <div className="flex flex-col">
        {sessions.map((s) => (
          <SessionRow key={s.id} session={s} corrections={correctionIds} showProject={false} when="relative" />
        ))}
      </div>
    </>
  );
}
