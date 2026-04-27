import { homedir } from 'node:os';
import { join } from 'node:path';
import { getDb, type TraceDb } from '@trace/db';

declare global {
  // eslint-disable-next-line no-var
  var __traceDb: TraceDb | undefined;
}

const TRACE_DB_PATH = join(homedir(), 'Trace', 'trace.db');

export function db(): TraceDb {
  if (!globalThis.__traceDb) globalThis.__traceDb = getDb(TRACE_DB_PATH);
  return globalThis.__traceDb;
}
