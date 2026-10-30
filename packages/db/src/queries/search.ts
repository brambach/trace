import type { TraceDb } from '../client.js';

export interface SearchResult {
  message_id: string;
  session_id: string;
  ai_title: string | null;
  project_name: string;
  timestamp: string;
  role: 'user' | 'assistant';
  snippet: string;
}

export interface SearchOptions {
  projects?: string[];
  role?: 'user' | 'assistant';
  limit?: number;
}

export function searchMessages(db: TraceDb, query: string, opts: SearchOptions = {}): SearchResult[] {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const limit = opts.limit ?? 50;
  const filters: string[] = [];
  // Quote each word so FTS5 syntax ("-", ":", a stray quote) can't throw.
  const match = trimmed
    .split(/\s+/u)
    .map((w) => `"${w.replaceAll('"', '""')}"`)
    .join(' ');
  const params: (string | number)[] = [match];

  if (opts.role) {
    filters.push('m.role = ?');
    params.push(opts.role);
  }
  if (opts.projects && opts.projects.length > 0) {
    filters.push(`s.project_name IN (${opts.projects.map(() => '?').join(',')})`);
    params.push(...opts.projects);
  }

  const where = filters.length === 0 ? '' : 'AND ' + filters.join(' AND ');

  type Row = {
    message_id: string;
    session_id: string;
    ai_title: string | null;
    project_name: string;
    timestamp: string;
    role: 'user' | 'assistant';
    snippet: string;
  };

  const sql = `
    SELECT
      m.id AS message_id,
      m.session_id AS session_id,
      s.ai_title AS ai_title,
      s.project_name AS project_name,
      m.timestamp AS timestamp,
      m.role AS role,
      snippet(messages_fts, 0, char(1), char(2), '…', 16) AS snippet
    FROM messages_fts
    JOIN messages m ON m.id = messages_fts.message_id
    JOIN sessions s ON s.id = m.session_id
    WHERE messages_fts MATCH ? AND m.kind IN ('prompt','reply','rejection')
    ${where}
    ORDER BY m.timestamp DESC
    LIMIT ${limit}
  `;

  // The snippet is your own text, so escape it before the dashboard renders it
  // as HTML. Only the match markers become tags.
  return db.sqlite
    .prepare<typeof params, Row>(sql)
    .all(...params)
    .map((r) => ({ ...r, snippet: escapeHtml(r.snippet).replaceAll('\u0001', '<mark>').replaceAll('\u0002', '</mark>') }));
}

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
