import type { SessionTimeline } from '@trace/shared';
import type { CoachResult } from './cluster.js';
import type { Fix } from './types.js';

const DAY = 86_400_000;

export interface FixStatus {
  state: 'waiting' | 'applied' | 'covered' | 'dismissed';
  saidSince: number;
}

export interface LetterDay {
  date: string;
  sessions: SessionTimeline[];
}

export interface Letter {
  weekStart: string;
  weekEnd: string;
  issue: number;
  headline: string;
  deck: string;
  days: LetterDay[];
  stats: { sessions: number; prompts: number; corrections: number; projects: number };
  shipped: { project: string; sessions: SessionTimeline[] }[];
  sideways: { session: SessionTimeline; corrections: number }[];
  habit: { fix: Fix; thisWeek: number } | null;
  held: Fix[];
}

export function weekStartOf(d: Date): Date {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(day).getUTCDay() + 6) % 7;
  return new Date(day - dow * DAY);
}

export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / DAY + 1) / 7);
}

// The week in one page, from local data only. Every sentence in it is
// counted, never generated.
export function buildLetter(
  timelines: SessionTimeline[],
  result: CoachResult,
  status: Map<string, FixStatus>,
  weekStart: Date,
): Letter {
  const ws = weekStart.getTime();
  const we = ws + 7 * DAY;
  const inWeek = (iso: string) => {
    const t = Date.parse(iso);
    return t >= ws && t < we;
  };
  const sessions = timelines.filter((s) => inWeek(s.started_at));
  const correctionIds = new Set(result.corrections.filter((c) => inWeek(c.timestamp)).map((c) => c.messageId));

  const days: LetterDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(ws + i * DAY).toISOString().slice(0, 10);
    return { date, sessions: sessions.filter((s) => s.started_at.slice(0, 10) === date) };
  });

  const prompts = sessions.reduce(
    (n, s) => n + s.events.filter((e) => e.kind === 'prompt' || (e.kind === 'rejection' && e.text !== '')).length,
    0,
  );
  const corrections = correctionIds.size;
  const byProject = new Map<string, SessionTimeline[]>();
  for (const s of sessions) byProject.set(s.project_name, [...(byProject.get(s.project_name) ?? []), s]);
  const shipped = [...byProject.entries()]
    .map(([project, list]) => ({ project, sessions: list }))
    .sort((a, b) => b.sessions.length - a.sessions.length);

  const sideways = sessions
    .map((session) => ({ session, corrections: session.events.filter((e) => correctionIds.has(e.id)).length }))
    .filter((s) => s.corrections > 0)
    .sort((a, b) => b.corrections - a.corrections || b.session.started_at.localeCompare(a.session.started_at))
    .slice(0, 3);

  const habit =
    result.fixes
      .filter((f) => status.get(f.id)?.state !== 'dismissed')
      .map((fix) => ({ fix, thisWeek: fix.evidence.filter((e) => inWeek(e.timestamp)).length }))
      .filter((h) => h.thisWeek > 0)
      .sort((a, b) => b.thisWeek - a.thisWeek || b.fix.times - a.fix.times)[0] ?? null;

  const held = result.fixes.filter((f) => {
    const s = status.get(f.id);
    return s?.state === 'applied' && s.saidSince === 0;
  });

  const projects = byProject.size;
  const headline =
    sessions.length === 0
      ? 'A quiet week.'
      : corrections === 0
        ? 'A clean week. You never had to correct the agent.'
        : habit
          ? `You told the agent to ${habit.fix.said} ${times(habit.thisWeek)} this week.`
          : `You corrected the agent ${times(corrections)} this week.`;
  const deck =
    sessions.length === 0
      ? 'No sessions this week.'
      : `${n(sessions.length, 'session')} across ${n(projects, 'project')}. ${n(prompts, 'prompt')}, ${n(corrections, 'correction')}.`;

  return {
    weekStart: new Date(ws).toISOString().slice(0, 10),
    weekEnd: new Date(we - DAY).toISOString().slice(0, 10),
    issue: isoWeek(weekStart),
    headline,
    deck,
    days,
    stats: { sessions: sessions.length, prompts, corrections, projects },
    shipped,
    sideways,
    habit,
    held,
  };
}

function n(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

function times(count: number): string {
  return count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`;
}

export function letterMarkdown(letter: Letter): string {
  const out: string[] = [];
  out.push(`# ${letter.headline}`, '', `_The Trace Letter, week of ${letter.weekStart}._`, '', letter.deck, '');
  if (letter.shipped.length > 0) {
    out.push('## What you worked on', '');
    for (const p of letter.shipped) {
      out.push(`**${p.project}**`, '');
      for (const s of p.sessions) out.push(`- ${s.ai_title ?? 'Untitled session'}`);
      out.push('');
    }
  }
  if (letter.sideways.length > 0) {
    out.push('## Where it went sideways', '');
    for (const s of letter.sideways) {
      out.push(`- ${s.session.ai_title ?? 'Untitled session'} (${s.session.project_name}): ${n(s.corrections, 'correction')}`);
    }
    out.push('');
  }
  if (letter.habit) {
    const { fix } = letter.habit;
    out.push('## The habit that cost the most', '');
    for (const e of fix.evidence.filter((x) => x.timestamp >= letter.weekStart).slice(-3)) out.push(`> ${e.quote.replace(/\s+/gu, ' ')}`, '');
    out.push(`Trace drafted this for \`${fix.target.path}\`:`, '', `    ${fix.line}`, '');
  }
  if (letter.held.length > 0) {
    out.push('## What held', '');
    for (const f of letter.held) out.push(`- ${f.line}`);
    out.push('');
  }
  out.push('---', '', 'Counted from your local session files. Nothing here was written by a model.', '');
  return out.join('\n');
}
