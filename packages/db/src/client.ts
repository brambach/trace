import type DatabaseT from 'better-sqlite3';
import { createRequire } from 'node:module';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TRACE_DB_PATH } from '@trace/shared';
import * as schema from './schema.js';
import { migrate } from './migrate.js';

// createRequire keeps the native better-sqlite3 binding out of webpack's bundle
// when the dashboard imports this package. The watcher (run via tsx) hits the
// same code path with no penalty.
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3') as typeof DatabaseT;

export type TraceDb = BetterSQLite3Database<typeof schema> & { sqlite: DatabaseT.Database };

export function getDb(path: string = TRACE_DB_PATH): TraceDb {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema }) as unknown as TraceDb;
  db.sqlite = sqlite;
  migrate(db);
  return db;
}

export function closeDb(db: TraceDb): void {
  db.sqlite.close();
}
