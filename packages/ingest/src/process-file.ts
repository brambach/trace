import { readFileSync, statSync } from 'node:fs';
import { parseLine, parseCodexLine, codexSessionIdFromPath } from '@trace/parser';
import type { ParsedEvent } from '@trace/shared';
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

  const lines: SourceLine[] = [];
  let offset = start;
  for (const l of text.slice(0, consumeUpTo).split('\n')) {
    if (l !== '') lines.push({ text: l, offset });
    offset += Buffer.byteLength(l, 'utf8') + 1;
  }

  const txn = db.sqlite.transaction(() => {
    ingestLines(db, filePath, lines);
    db.sqlite
      .prepare(
        `INSERT INTO file_offsets (session_file_path, last_byte_read, last_processed_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(session_file_path) DO UPDATE SET
           last_byte_read = excluded.last_byte_read,
           last_processed_at = excluded.last_processed_at`,
      )
      .run(filePath, start + Buffer.byteLength(text.slice(0, consumeUpTo), 'utf8') + 1);
  });

  txn();
}

export interface SourceLine {
  text: string;
  // Byte offset of the line in its file. Codex lines take their id from it.
  offset: number;
}

// Parses and inserts lines from one session file, then recomputes the
// aggregates of every session they touched. Callers own the transaction.
export function ingestLines(db: TraceDb, filePath: string, lines: SourceLine[]): void {
  const codexSession = codexSessionIdFromPath(filePath);
  const parse = (line: SourceLine): ParsedEvent | null =>
    codexSession
      ? parseCodexLine(line.text, { sessionId: codexSession, lineId: `${codexSession}:${line.offset}` })
      : parseLine(line.text);

  const touchedSessions = new Set<string>();
  for (const line of lines) {
    const ev = parse(line);
    if (!ev) continue;
    const sessionId = insertEvent(db, filePath, ev);
    if (sessionId) touchedSessions.add(sessionId);
  }
  for (const sessionId of touchedSessions) {
    recomputeSessionAggregates(db, sessionId);
  }
}
