import { getDb, type TraceDb } from '@trace/db';

declare global {
  // eslint-disable-next-line no-var
  var __traceDb: TraceDb | undefined;
}

export function db(): TraceDb {
  if (!globalThis.__traceDb) globalThis.__traceDb = getDb();
  return globalThis.__traceDb;
}
