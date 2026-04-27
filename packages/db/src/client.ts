import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TRACE_DB_PATH } from '@trace/shared';
import * as schema from './schema.js';
import { migrate } from './migrate.js';

export type TraceDb = BetterSQLite3Database<typeof schema> & { sqlite: Database.Database };

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
