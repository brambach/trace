import type { Agent, MessageKind, SessionTimeline, TimelineEvent, ToolUse } from '@trace/shared';
import type { TraceDb } from '../client.js';

export interface TimelineFilter {
  sinceIso?: string;
  sessionIds?: string[];
}

// Every session that touched the window, with its prompts, replies and tool
// calls in order. Meta lines and tool results are dropped; the coach and the
// replay only need what you said and what the agent did.
export function loadTimelines(db: TraceDb, filter: TimelineFilter = {}): SessionTimeline[] {
  type SRow = {
    id: string;
    cwd: string;
    project_name: string;
    agent: Agent;
    ai_title: string | null;
    started_at: string;
    ended_at: string;
  };
  const where: string[] = [];
  const params: string[] = [];
  if (filter.sinceIso) {
    where.push('ended_at >= ?');
    params.push(filter.sinceIso);
  }
  if (filter.sessionIds) {
    if (filter.sessionIds.length === 0) return [];
    where.push(`id IN (${filter.sessionIds.map(() => '?').join(',')})`);
    params.push(...filter.sessionIds);
  }
  const sessions = db.sqlite
    .prepare<string[], SRow>(
      `SELECT id, cwd, project_name, agent, ai_title, started_at, ended_at FROM sessions
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY started_at ASC`,
    )
    .all(...params);
  if (sessions.length === 0) return [];

  type MRow = { id: string; session_id: string; role: 'user' | 'assistant'; kind: MessageKind; timestamp: string; content_text: string };
  type TRow = { message_id: string; tool_name: string; arguments_json: string };
  const msgStmt = db.sqlite.prepare<[string], MRow>(
    `SELECT id, session_id, role, kind, timestamp, content_text FROM messages
     WHERE session_id = ? AND kind IN ('prompt','reply','interrupt','rejection')
     ORDER BY timestamp ASC, rowid ASC`,
  );
  const toolStmt = db.sqlite.prepare<[string], TRow>(
    `SELECT message_id, tool_name, arguments_json FROM tool_calls WHERE session_id = ? ORDER BY timestamp ASC, rowid ASC`,
  );

  return sessions.map((s) => {
    const tools = new Map<string, ToolUse[]>();
    for (const t of toolStmt.all(s.id)) {
      const list = tools.get(t.message_id) ?? [];
      list.push({ name: t.tool_name, input: parseArgs(t.arguments_json) });
      tools.set(t.message_id, list);
    }
    const events: TimelineEvent[] = msgStmt.all(s.id).map((m) => ({
      id: m.id,
      timestamp: m.timestamp,
      role: m.role,
      kind: m.kind,
      text: m.content_text,
      tools: tools.get(m.id) ?? [],
    }));
    // Codex writes no title, so fall back to the first thing you asked.
    return { ...s, ai_title: s.ai_title ?? titleFrom(events), events };
  });
}

function titleFrom(events: TimelineEvent[]): string | null {
  const first = events.find((e) => e.kind === 'prompt')?.text.replace(/\s+/gu, ' ').trim();
  if (!first) return null;
  const clipped = first.length > 64 ? `${first.slice(0, 63).replace(/\s+\S*$/u, '')}…` : first;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

function parseArgs(json: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
