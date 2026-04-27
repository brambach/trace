import { readFileSync, statSync } from 'node:fs';
import { parseLine } from '@trace/parser';
import type { TraceDb } from '@trace/db';
import { insertEvent, recomputeSessionAggregates } from './inserts.js';

export function processFile(db: TraceDb, filePath: string): void {
  let size: number;
  try {
    size = statSync(filePath).size;
  } catch {
    return;
  }

  type OffsetRow = { last_byte_read: number };
  const row = db.sqlite
    .prepare<[string], OffsetRow>(
      `SELECT last_byte_read FROM file_offsets WHERE session_file_path = ?`,
    )
    .get(filePath);

  const start = row?.last_byte_read ?? 0;
  if (start >= size) return;

  const buf = readFileSync(filePath);
  const slice = buf.slice(start);
  const text = slice.toString('utf8');

  const lastNewline = text.lastIndexOf('\n');
  const consumeUpTo = lastNewline === -1 ? -1 : lastNewline;
  if (consumeUpTo === -1) return;

  const lines = text.slice(0, consumeUpTo).split('\n').filter((l) => l !== '');

  const txn = db.sqlite.transaction(() => {
    const touchedSessions = new Set<string>();
    for (const line of lines) {
      const ev = parseLine(line);
      if (!ev) continue;
      const sessionId = insertEvent(db, filePath, ev);
      if (sessionId) touchedSessions.add(sessionId);
    }
    for (const sessionId of touchedSessions) {
      recomputeSessionAggregates(db, sessionId);
    }
    db.sqlite
      .prepare(
        `INSERT INTO file_offsets (session_file_path, last_byte_read, last_processed_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(session_file_path) DO UPDATE SET
           last_byte_read = excluded.last_byte_read,
           last_processed_at = excluded.last_processed_at`,
      )
      .run(filePath, start + consumeUpTo + 1);
  });

  txn();
}
