import type { TraceDb } from '../client.js';

export interface ProjectDetail {
  project_name: string;
  cwd: string;
  current_focus: string | null;
  total_sessions: number;
  total_messages: number;
  last_touched: string;
  sessions: SessionTimelineRow[];
}

export interface SessionTimelineRow {
  id: string;
  ai_title: string | null;
  first_user_message: string | null;
  started_at: string;
  ended_at: string;
  message_count: number;
  ended_without_assistant_reply: boolean;
}

export function getProjectDetail(db: TraceDb, projectName: string): ProjectDetail | null {
  const meta = db.sqlite
    .prepare<[string, string], { cwd: string; total_sessions: number; total_messages: number; last_touched: string; ai_title: string | null }>(
      `SELECT
         s.cwd,
         COUNT(DISTINCT s.id) AS total_sessions,
         COUNT(m.id)          AS total_messages,
         MAX(s.ended_at)      AS last_touched,
         (SELECT ai_title FROM sessions s2 WHERE s2.project_name = ? ORDER BY s2.ended_at DESC LIMIT 1) AS ai_title
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       WHERE s.project_name = ?`,
    )
    .get(projectName, projectName);

  if (!meta || !meta.cwd) return null;

  type Row = {
    id: string;
    ai_title: string | null;
    first_user_message: string | null;
    started_at: string;
    ended_at: string;
    message_count: number;
    ended_without_assistant_reply: number;
  };

  const sessionsRows = db.sqlite
    .prepare<[string], Row>(
      `SELECT id, ai_title, first_user_message, started_at, ended_at, message_count, ended_without_assistant_reply
       FROM sessions
       WHERE project_name = ?
       ORDER BY ended_at DESC`,
    )
    .all(projectName);

  return {
    project_name: projectName,
    cwd: meta.cwd,
    current_focus: meta.ai_title,
    total_sessions: meta.total_sessions,
    total_messages: meta.total_messages,
    last_touched: meta.last_touched,
    sessions: sessionsRows.map((r) => ({
      id: r.id,
      ai_title: r.ai_title,
      first_user_message: r.first_user_message,
      started_at: r.started_at,
      ended_at: r.ended_at,
      message_count: r.message_count,
      ended_without_assistant_reply: Boolean(r.ended_without_assistant_reply),
    })),
  };
}
