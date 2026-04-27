import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, type TraceDb } from '@trace/db';
import { processFile } from '../src/process-file.js';

let dir: string;
let db: TraceDb;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trace-watch-'));
  db = getDb(':memory:');
});

afterEach(() => {
  closeDb(db);
  rmSync(dir, { recursive: true, force: true });
});

describe('processFile', () => {
  it('inserts messages from a fresh file', () => {
    const path = join(dir, 'session.jsonl');
    const userLine = JSON.stringify({
      type: 'user',
      sessionId: 'sess-1',
      timestamp: '2026-04-26T12:00:00.000Z',
      uuid: 'uuid-u-1',
      cwd: '/Users/me/projects/trace',
      gitBranch: 'main',
      message: { role: 'user', content: 'fix src/parser.ts' },
    });
    const assistantLine = JSON.stringify({
      type: 'assistant',
      sessionId: 'sess-1',
      timestamp: '2026-04-26T12:00:01.000Z',
      uuid: 'uuid-a-1',
      cwd: '/Users/me/projects/trace',
      message: { role: 'assistant', content: [{ type: 'text', text: 'On it' }] },
    });
    writeFileSync(path, `${userLine}\n${assistantLine}\n`);
    processFile(db, path);

    const messages = db.sqlite.prepare(`SELECT id, role FROM messages ORDER BY timestamp`).all();
    expect(messages).toHaveLength(2);

    const session = db.sqlite
      .prepare(`SELECT message_count, turn_count, project_name FROM sessions WHERE id = 'sess-1'`)
      .get() as { message_count: number; turn_count: number; project_name: string };
    expect(session.message_count).toBe(2);
    expect(session.turn_count).toBe(1);
    expect(session.project_name).toBe('trace');
  });

  it('is idempotent — reprocessing the same file does not duplicate', () => {
    const path = join(dir, 'session.jsonl');
    const line = JSON.stringify({
      type: 'user',
      sessionId: 'sess-2',
      timestamp: '2026-04-26T12:00:00.000Z',
      uuid: 'uuid-u-1',
      message: { role: 'user', content: 'hi' },
    });
    writeFileSync(path, `${line}\n`);
    processFile(db, path);
    processFile(db, path);
    const count = (db.sqlite.prepare(`SELECT COUNT(*) AS n FROM messages`).get() as { n: number })
      .n;
    expect(count).toBe(1);
  });

  it('processes only new bytes on append', () => {
    const path = join(dir, 'session.jsonl');
    const line1 = JSON.stringify({
      type: 'user',
      sessionId: 'sess-3',
      timestamp: '2026-04-26T12:00:00.000Z',
      uuid: 'uuid-u-1',
      message: { role: 'user', content: 'first' },
    });
    writeFileSync(path, `${line1}\n`);
    processFile(db, path);

    const line2 = JSON.stringify({
      type: 'user',
      sessionId: 'sess-3',
      timestamp: '2026-04-26T12:00:01.000Z',
      uuid: 'uuid-u-2',
      message: { role: 'user', content: 'second' },
    });
    appendFileSync(path, `${line2}\n`);
    processFile(db, path);

    const ids = db.sqlite
      .prepare(`SELECT id FROM messages ORDER BY timestamp`)
      .all() as { id: string }[];
    expect(ids.map((r) => r.id)).toEqual(['uuid-u-1', 'uuid-u-2']);
  });
});
