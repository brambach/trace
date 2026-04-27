import type { TraceDb } from '../client.js';

export interface ProjectCard {
  project_name: string;
  cwd: string;
  last_touched: string;
  current_focus: string | null;
  open_thread: boolean;
  total_sessions: number;
  total_messages: number;
  spark: number[];
  stalled_days: number;
}

export function getProjectCards(db: TraceDb, days: number = 14): ProjectCard[] {
  type Row = {
    project_name: string;
    cwd: string;
    total_sessions: number;
    total_messages: number;
    last_touched: string;
    ai_title: string | null;
    open_thread: number;
  };

  const rows = db.sqlite
    .prepare<[], Row>(
      `SELECT
         s.project_name,
         s.cwd,
         COUNT(DISTINCT s.id) AS total_sessions,
         COUNT(m.id)          AS total_messages,
         MAX(s.ended_at)      AS last_touched,
         (SELECT ai_title FROM sessions s2
            WHERE s2.project_name = s.project_name
            ORDER BY s2.ended_at DESC LIMIT 1) AS ai_title,
         (SELECT ended_without_assistant_reply FROM sessions s3
            WHERE s3.project_name = s.project_name
            ORDER BY s3.ended_at DESC LIMIT 1) AS open_thread
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       GROUP BY s.project_name
       ORDER BY last_touched DESC`,
    )
    .all();

  const now = Date.now();
  return rows.map((r) => {
    const last = Date.parse(r.last_touched);
    const stalled = Math.max(0, Math.floor((now - last) / (1000 * 60 * 60 * 24)));
    return {
      project_name: r.project_name,
      cwd: r.cwd,
      last_touched: r.last_touched,
      current_focus: r.ai_title,
      open_thread: Boolean(r.open_thread),
      total_sessions: r.total_sessions,
      total_messages: r.total_messages,
      spark: getProjectSpark(db, r.project_name, days),
      stalled_days: stalled,
    };
  });
}

function getProjectSpark(db: TraceDb, project: string, days: number): number[] {
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
