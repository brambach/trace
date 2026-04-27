import type { TraceDb } from '@trace/db';
import type { ParsedEvent } from '@trace/shared';
import { basename } from 'node:path';

// Returns the session id touched by this event, or null for noise / unknown.
// recomputeSessionAggregates is intentionally NOT called here. Per-event
// recompute is O(session size) and turns initial scans into O(n^2). The
// caller (process-file) collects touched session ids and recomputes once
// at the end of each file's transaction.
export function insertEvent(
  db: TraceDb,
  filePath: string,
  ev: ParsedEvent,
): string | null {
  if (ev.kind === 'noise') return null;
  if (ev.kind === 'ai-title') {
    db.sqlite
      .prepare(`UPDATE sessions SET ai_title = ? WHERE id = ?`)
      .run(ev.aiTitle, ev.sessionId);
    return ev.sessionId;
  }

  const projectName =
    ev.cwd && ev.cwd !== ''
      ? basename(ev.cwd)
      : decodeProjectFromFilePath(filePath);
  const cwd = ev.cwd ?? '';
  ensureSession(db, ev.sessionId, cwd, projectName, ev.gitBranch ?? null, ev.timestamp);

  db.sqlite
    .prepare(
      `INSERT INTO messages (
         id, session_id, role, content, content_text, cwd, git_branch, timestamp, token_count_estimate,
         word_count, has_file_path, has_code_block, has_error_message, is_interrogative, retry_signal
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT(id) DO NOTHING`,
    )
    .run(
      ev.uuid,
      ev.sessionId,
      ev.role,
      JSON.stringify(ev.contentRaw),
      ev.contentText,
      ev.cwd ?? null,
      ev.gitBranch ?? null,
      ev.timestamp,
      ev.tokenCountEstimate,
      ev.features.word_count,
      bool(ev.features.has_file_path),
      bool(ev.features.has_code_block),
      bool(ev.features.has_error_message),
      bool(ev.features.is_interrogative),
      bool(ev.features.retry_signal),
    );

  for (const tc of ev.toolCalls) {
    db.sqlite
      .prepare(
        `INSERT INTO tool_calls (id, session_id, message_id, tool_name, arguments_json, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run(tc.id, ev.sessionId, ev.uuid, tc.name, tc.arguments_json, ev.timestamp);
  }

  return ev.sessionId;
}

function decodeProjectFromFilePath(filePath: string): string {
  const parent = basename(filePath.replace(/\/[^/]+$/, ''));
  const segments = parent.split('-').filter((s) => s !== '');
  return segments.at(-1) ?? 'unknown';
}

function ensureSession(
  db: TraceDb,
  id: string,
  cwd: string,
  projectName: string,
  gitBranch: string | null,
  timestamp: string,
): void {
  db.sqlite
    .prepare(
      `INSERT INTO sessions (id, cwd, project_name, git_branch, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         cwd = excluded.cwd,
         project_name = excluded.project_name,
         git_branch = COALESCE(excluded.git_branch, sessions.git_branch)`,
    )
    .run(id, cwd, projectName, gitBranch, timestamp, timestamp);
}

export function recomputeSessionAggregates(db: TraceDb, sessionId: string): void {
  db.sqlite
    .prepare(
      `UPDATE sessions SET
         message_count = (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id),
         turn_count    = (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id AND role = 'user'),
         tool_call_count = (SELECT COUNT(*) FROM tool_calls WHERE session_id = sessions.id),
         retry_signal_count = (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id AND role = 'user' AND retry_signal = 1),
         assistant_question_count = (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id AND role = 'assistant' AND content_text LIKE '%?%'),
         ended_at = (SELECT MAX(timestamp) FROM messages WHERE session_id = sessions.id),
         started_at = (SELECT MIN(timestamp) FROM messages WHERE session_id = sessions.id),
         first_user_message = (
           SELECT content_text FROM messages
           WHERE session_id = sessions.id AND role = 'user'
           ORDER BY timestamp ASC LIMIT 1
         ),
         ended_without_assistant_reply = (
           SELECT CASE WHEN role = 'user' THEN 1 ELSE 0 END
           FROM messages WHERE session_id = sessions.id
           ORDER BY timestamp DESC LIMIT 1
         ),
         first_response_was_tool = (
           SELECT CASE
             WHEN EXISTS (
               SELECT 1 FROM tool_calls tc
               WHERE tc.session_id = sessions.id
                 AND tc.message_id = (
                   SELECT id FROM messages
                   WHERE session_id = sessions.id AND role = 'assistant'
                   ORDER BY timestamp ASC LIMIT 1
                 )
             ) THEN 1 ELSE 0 END
         )
       WHERE id = ?`,
    )
    .run(sessionId);
}

function bool(b: boolean): 0 | 1 {
  return b ? 1 : 0;
}
