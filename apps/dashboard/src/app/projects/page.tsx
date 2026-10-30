import type { Metadata } from 'next';
import { Masthead } from '@/components/Masthead';
import { Sparkline } from '@/components/Sparkline';
import { AgentMark } from '@/components/AgentMark';
import { Inline } from '@/components/Inline';
import { getCoach } from '@/lib/coach';
import { plural, relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Projects' };

const DAY = 86_400_000;

export default function ProjectsPage() {
  const { timelines, corrections, views } = getCoach();
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  const byProject = new Map<string, typeof timelines>();
  for (const t of timelines) byProject.set(t.project_name, [...(byProject.get(t.project_name) ?? []), t]);

  const cards = [...byProject.entries()]
    .map(([name, sessions]) => {
      const latest = sessions.reduce((a, b) => (a.ended_at > b.ended_at ? a : b));
      const spark = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today - (13 - i) * DAY).toISOString().slice(0, 10);
        return sessions
          .filter((s) => s.started_at.slice(0, 10) === d)
          .reduce((n, s) => n + s.events.filter((e) => e.kind === 'prompt').length, 0);
      });
      return {
        name,
        sessions,
        latest,
        spark,
        agents: [...new Set(sessions.map((s) => s.agent))],
        corrected: corrections.filter((c) => c.project_name === name).length,
        fixes: views.filter((v) => v.state === 'waiting' && v.fix.target.scope === 'project' && v.fix.projects[0] === name).length,
      };
    })
    .sort((a, b) => b.latest.ended_at.localeCompare(a.latest.ended_at));

  return (
    <>
      <Masthead
        eyebrow="Projects"
        headline="Everything you're building, side by side."
        deck={`${plural(cards.length, 'project')} in the last 60 days, most recent first.`}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <a
            key={c.name}
            href={`/projects/${encodeURIComponent(c.name)}`}
            className="group flex flex-col gap-3 rounded-[14px] bg-raised p-5 shadow-float transition-transform duration-[220ms] ease-out hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[18px] font-medium">
                {c.name}
                <span className="flex gap-1 text-muted">{c.agents.map((a) => <AgentMark key={a} agent={a} className="h-3 w-3" />)}</span>
              </span>
              {c.fixes > 0 && <span className="num rounded-full bg-mark-wash px-2 py-0.5 text-[12px] font-medium text-mark">{plural(c.fixes, 'fix', 'fixes')}</span>}
            </div>
            <p className="line-clamp-2 text-[14.5px] text-ink-2"><Inline text={c.latest.ai_title ?? ''} /></p>
            <Sparkline values={c.spark} />
            <div className="flex flex-wrap justify-between gap-x-3 text-[13px] text-muted">
              <span className="num">
                {plural(c.sessions.length, 'session')}
                {c.corrected > 0 && <span className="text-mark"> · {plural(c.corrected, 'correction')}</span>}
              </span>
              <span>{relativeTime(c.latest.ended_at)}</span>
            </div>
          </a>
        ))}
        {cards.length === 0 && <p className="text-muted">No projects yet.</p>}
      </div>
    </>
  );
}
