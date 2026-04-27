import {
  getTodaySummary,
  getProjectLedgerForToday,
  getDailyMessageCounts,
} from '@trace/db';
import { db } from '@/lib/db';
import { Masthead } from '@/components/Masthead';
import { ProjectRow } from '@/components/ProjectRow';
import { AmbientChart } from '@/components/AmbientChart';
import { humanInt, todayIso, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function Home() {
  const today = todayIso();
  const summary = getTodaySummary(db(), today);
  const ledger = getProjectLedgerForToday(db(), today);
  const fourteen = getDailyMessageCounts(db(), 14);

  const eyebrow = `Today · ${formatDate(`${today}T12:00:00Z`)}`;
  const headline = summary.headline ?? 'Quiet day.';

  const sessionCount = summary.session_count;
  const projectsCount = ledger.filter((p) => p.session_count > 0).length;
  const stalledCount = ledger.length - projectsCount;
  const ledgerLabel = `${sessionCount} session${sessionCount === 1 ? '' : 's'} · ${projectsCount} active${stalledCount > 0 ? ` · ${stalledCount} quiet` : ''}`;

  return (
    <>
      <Masthead eyebrow={eyebrow} headline={headline} deck={summary.deck} />

      <div className="reveal r3 mb-7 flex items-center gap-4 font-mono text-[11.5px] tracking-[0.04em] text-dim">
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{summary.message_count}</strong>{' '}
          messages
        </span>
        <span className="h-3.5 w-px bg-rule" />
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{summary.session_count}</strong>{' '}
          sessions
        </span>
        <span className="h-3.5 w-px bg-rule" />
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{humanInt(summary.token_estimate)}</strong>{' '}
          tokens
        </span>
      </div>

      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 mb-4 flex items-baseline justify-between">
        <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">Today&apos;s projects</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">{ledgerLabel}</span>
      </div>

      <div className="reveal r5 flex flex-col">
        {ledger.length === 0 && (
          <p className="py-6 italic text-dim">
            No sessions yet. Run Claude Code in any project and this page will fill in.
          </p>
        )}
        {ledger.map((row, i) => (
          <ProjectRow
            key={row.project_name}
            name={row.project_name}
            cwd={row.cwd}
            sessionCount={row.session_count}
            messageCount={row.message_count}
            aiTitle={row.ai_title}
            openThread={row.open_thread}
            lastTouched={row.last_touched}
            spark={row.spark}
            primary={i === 0}
          />
        ))}
      </div>

      <div className="reveal r6">
        <AmbientChart values={fourteen} />
      </div>
    </>
  );
}
