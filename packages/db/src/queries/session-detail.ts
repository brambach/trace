import type { TraceDb } from '../client.js';

export interface SessionDetail {
  id: string;
  project_name: string;
  ai_title: string | null;
  started_at: string;
  ended_at: string;
  messages: SessionMessage[];
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  content_text: string;
}

export function getSessionDetail(db: TraceDb, sessionId: string): SessionDetail | null {
  type SRow = {
    id: string;
    project_name: string;
    ai_title: string | null;
    started_at: string;
    ended_at: string;
  };
  const session = db.sqlite
    .prepare<[string], SRow>(
      `SELECT id, project_name, ai_title, started_at, ended_at FROM sessions WHERE id = ?`,
    )
    .get(sessionId);
  if (!session) return null;

  type MRow = { id: string; role: 'user' | 'assistant'; timestamp: string; content_text: string };
  const messages = db.sqlite
    .prepare<[string], MRow>(
      `SELECT id, role, timestamp, content_text FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
    )
    .all(sessionId);

  return { ...session, messages };
}
