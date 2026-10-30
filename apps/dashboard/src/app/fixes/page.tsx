import type { Metadata } from 'next';
import { planEdit, type Fix } from '@trace/coach';
import { Masthead, SectionHead } from '@/components/Masthead';
import { FixActions, RestoreButton } from '@/components/FixActions';
import { Inline } from '@/components/Inline';
import { displayPath, getCoach, readClaudeMd, type FixView } from '@/lib/coach';
import { formatDate, plural, relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Fixes' };

const KIND: Record<Fix['kind'], string> = {
  'package-manager': 'Package manager',
  command: 'Command',
  'your-words': 'In your words',
};

export default function FixesPage() {
  const { views } = getCoach();
  const waiting = views.filter((v) => v.state === 'waiting');
  const applied = views.filter((v) => v.state === 'applied');
  const covered = views.filter((v) => v.state === 'covered');
  const dismissed = views.filter((v) => v.state === 'dismissed');
  const held = applied.filter((v) => v.saidSince === 0).length;

  return (
    <>
      <Masthead
        eyebrow="Fixes"
        headline={waiting.length === 0 ? 'Nothing new to write down.' : `${cap(plural(waiting.length, 'habit'))} worth writing down.`}
        deck="Each one is something you told the agent in more than one session. Apply it and the agent reads it before every session, so you can stop saying it."
      >
        {applied.length > 0 && (
          <p className="mt-3 text-[14px] text-muted">
            You&apos;ve applied {plural(applied.length, 'fix', 'fixes')}. {held === applied.length ? 'All of them held.' : `${held} held.`}
          </p>
        )}
      </Masthead>

      <div className="flex flex-col gap-8">
        {waiting.map((v) => (
          <FixCard key={v.fix.id} view={v} />
        ))}
      </div>

      {applied.length > 0 && (
        <section className="mt-16">
          <SectionHead title="Applied" note="Did it hold?" />
          {applied.map((v) => (
            <Quiet key={v.fix.id} view={v}>
              <span className={`flex items-center gap-1.5 font-medium ${v.saidSince === 0 ? 'text-held' : 'text-mark'}`}>
                {v.saidSince === 0 ? <Check /> : <Cross />}
                {v.saidSince === 0 ? 'Held' : `Said ${plural(v.saidSince, 'time')} since`}
              </span>
              <span>
                {v.decision?.how === 'pr' && v.decision.pr_url ? (
                  <a href={v.decision.pr_url} className="underline decoration-line-strong underline-offset-4">PR</a>
                ) : (
                  'Written'
                )}{' '}
                {v.decision ? formatDate(v.decision.decided_at) : ''}
              </span>
            </Quiet>
          ))}
        </section>
      )}

      {covered.length > 0 && (
        <section className="mt-16">
          <SectionHead title="Already written down" note="The agent may be skipping these" />
          {covered.map((v) => (
            <Quiet key={v.fix.id} view={v}>
              <span>In {displayPath(v.fix.target.path)}, and you still said it {plural(v.fix.times, 'time')}.</span>
            </Quiet>
          ))}
        </section>
      )}

      {dismissed.length > 0 && (
        <section className="mt-16">
          <SectionHead title="Dismissed" />
          {dismissed.map((v) => (
            <Quiet key={v.fix.id} view={v}>
              <RestoreButton id={v.fix.id} />
            </Quiet>
          ))}
        </section>
      )}

      {views.length === 0 && (
        <p className="max-w-[56ch] text-ink-2">
          When you correct the agent the same way in two sessions, the fix shows up here. Trace counts a correction when you stop the agent, reject a tool call, or redirect it (&ldquo;no, use pnpm&rdquo;, &ldquo;I said…&rdquo;, &ldquo;don&apos;t…&rdquo;).
        </p>
      )}
    </>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function FixCard({ view }: { view: FixView }) {
  const { fix } = view;
  const plan = planEdit(fix.target.path, fix.line, readClaudeMd(fix.target.path));
  const shown = fix.evidence.slice(-3).reverse();
  return (
    <article id={`fix-${fix.id}`} className="scroll-mt-8 rounded-[14px] bg-raised p-5 shadow-float sm:p-7">
      <div className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted">
        {KIND[fix.kind]} · {fix.target.scope === 'global' ? 'every project' : fix.projects[0]}
      </div>
      <h2 className="mt-2 font-display text-[30px] leading-[1.1] tracking-[-0.01em]">{fix.habit}</h2>
      <p className="mt-2 text-ink-2">
        You said it {plural(fix.times, 'time')} in {plural(fix.sessions, 'session')}
        {fix.projects.length > 1 ? ` across ${fix.projects.join(', ')}` : ''}, most recently {relativeTime(fix.last_seen)}.
      </p>

      <ul className="mt-5 flex flex-col gap-3">
        {shown.map((e) => (
          <li key={e.messageId}>
            <a href={`/sessions/${encodeURIComponent(e.sessionId)}?at=${encodeURIComponent(e.messageId)}`} className="group block rounded-[10px] border-l-2 border-mark py-1 pl-4">
              <q className="block text-[15px] leading-[1.55] text-ink [quotes:none]"><Inline text={clip(e.quote)} /></q>
              <span className="mt-1 block text-[13px] text-muted">
                {e.project_name} · {formatDate(e.timestamp)}
                {e.did ? <> · after it <Inline text={e.did} /></> : null}
                <span className="ml-1.5 text-ink opacity-0 transition-opacity duration-[140ms] group-hover:opacity-100" aria-hidden>Replay →</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {fix.evidence.length > 3 && <p className="mt-2 pl-[18px] text-[13px] text-faint">and {plural(fix.evidence.length - 3, 'more time')}</p>}

      <FixActions
        id={fix.id}
        path={displayPath(fix.target.path)}
        added={plan.added}
        creates={!plan.exists}
        pr={view.pr}
      />
    </article>
  );
}

function clip(s: string): string {
  const t = s.replace(/\s+/gu, ' ').trim();
  return t.length > 220 ? `${t.slice(0, 219)}…` : t;
}

function Quiet({ view, children }: { view: FixView; children: React.ReactNode }) {
  return (
    <div id={`fix-${view.fix.id}`} className="scroll-mt-8 border-b border-line py-4 last:border-b-0">
      <div className="text-[15.5px] text-ink"><Inline text={view.fix.line} /></div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        <span>{view.fix.target.scope === 'global' ? 'Every project' : view.fix.projects[0]}</span>
        {children}
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
