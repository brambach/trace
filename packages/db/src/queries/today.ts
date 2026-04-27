import type { TraceDb } from '../client.js';

export interface TodaySummary {
  date: string;
  message_count: number;
  session_count: number;
  token_estimate: number;
  headline: string | null;
  deck: string;
}

export interface ProjectLedgerRow {
  project_name: string;
  cwd: string;
  session_count: number;
  message_count: number;
  ai_title: string | null;
  open_thread: boolean;
  last_touched: string;
  spark: number[];
}

export function getTodaySummary(db: TraceDb, todayIso: string): TodaySummary {
  const start = `${todayIso}T00:00:00.000Z`;
  const end = `${todayIso}T23:59:59.999Z`;

  const stats = db.sqlite
    .prepare<[string, string], { msgs: number; tokens: number; sessions: number }>(
      `SELECT
         COUNT(*) AS msgs,
         COALESCE(SUM(token_count_estimate), 0) AS tokens,
         COUNT(DISTINCT session_id) AS sessions
       FROM messages
       WHERE timestamp >= ? AND timestamp <= ?`,
    )
    .get(start, end) ?? { msgs: 0, tokens: 0, sessions: 0 };

  const headlineRow = db.sqlite
    .prepare<[string, string], { ai_title: string | null }>(
      `SELECT s.ai_title
       FROM sessions s
       JOIN messages m ON m.session_id = s.id
       WHERE m.timestamp >= ? AND m.timestamp <= ?
       GROUP BY s.id
       ORDER BY COUNT(m.id) DESC
       LIMIT 1`,
    )
    .get(start, end);

  const projectsToday = db.sqlite
    .prepare<[string, string], { project_name: string }>(
      `SELECT DISTINCT s.project_name
       FROM sessions s JOIN messages m ON m.session_id = s.id
       WHERE m.timestamp >= ? AND m.timestamp <= ?`,
    )
    .all(start, end);

  const sessionsCount = stats.sessions;
  const projectsCount = projectsToday.length;
  const deck =
    sessionsCount === 0
      ? 'No sessions today.'
      : `${sessionsCount} session${sessionsCount === 1 ? '' : 's'} across ${projectsCount} project${projectsCount === 1 ? '' : 's'}, ${stats.msgs} messages.`;

  return {
    date: todayIso,
    message_count: stats.msgs,
    session_count: stats.sessions,
    token_estimate: stats.tokens,
    headline: headlineRow?.ai_title ?? null,
    deck,
  };
}

export function getProjectLedgerForToday(db: TraceDb, todayIso: string): ProjectLedgerRow[] {
  const start = `${todayIso}T00:00:00.000Z`;
  const end = `${todayIso}T23:59:59.999Z`;

  type Row = {
    project_name: string;
    cwd: string;
    session_count: number;
    message_count: number;
    ai_title: string | null;
    open_thread: number;
    last_touched: string;
  };

  const rows = db.sqlite
    .prepare<[string, string], Row>(
      `WITH latest AS (
         SELECT s.project_name, MAX(s.ended_at) AS last_touched
         FROM sessions s
         GROUP BY s.project_name
       )
       SELECT
         s.project_name,
         s.cwd,
         COUNT(DISTINCT s.id) AS session_count,
         COUNT(m.id)          AS message_count,
         (SELECT ai_title FROM sessions s2
            WHERE s2.project_name = s.project_name
            ORDER BY s2.ended_at DESC LIMIT 1) AS ai_title,
         (SELECT ended_without_assistant_reply FROM sessions s3
            WHERE s3.project_name = s.project_name
            ORDER BY s3.ended_at DESC LIMIT 1) AS open_thread,
         latest.last_touched
       FROM sessions s
       JOIN latest ON latest.project_name = s.project_name
       LEFT JOIN messages m
         ON m.session_id = s.id
        AND m.timestamp >= ? AND m.timestamp <= ?
       GROUP BY s.project_name
       ORDER BY latest.last_touched DESC`,
    )
    .all(start, end);

  return rows.map((r) => ({
    project_name: r.project_name,
    cwd: r.cwd,
    session_count: r.session_count,
    message_count: r.message_count,
    ai_title: r.ai_title,
    open_thread: Boolean(r.open_thread),
    last_touched: r.last_touched,
    spark: getDailyMessageCountsForProject(db, r.project_name, 14),
  }));
}

function getDailyMessageCountsForProject(db: TraceDb, project: string, days: number): number[] {
  type Row = { day: string; n: number };
  const rows = db.sqlite
    .prepare<[string, number], Row>(
      `SELECT substr(m.timestamp, 1, 10) AS day, COUNT(*) AS n
       FROM messages m JOIN sessions s ON s.id = m.session_id
       WHERE s.project_name = ?
       GROUP BY day
       ORDER BY day DESC
       LIMIT ?`,
    )
    .all(project, days);
  const today = new Date();
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const hit = rows.find((r) => r.day === iso);
    out.push(hit ? hit.n : 0);
  }
  return out;
}

export function getDailyMessageCounts(db: TraceDb, days: number): number[] {
  type Row = { day: string; n: number };
  const rows = db.sqlite
    .prepare<[number], Row>(
      `SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS n
       FROM messages
       GROUP BY day
       ORDER BY day DESC
       LIMIT ?`,
    )
    .all(days);
  const today = new Date();
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const hit = rows.find((r) => r.day === iso);
    out.push(hit ? hit.n : 0);
  }
  return out;
}
