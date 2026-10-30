import { getDb, type TraceDb } from '@trace/db';
import { TRACE_DB_PATH } from '@trace/shared';
import { buildDemo, type Demo } from '@trace/demo';
import { isDemo } from './mode';

declare global {
  // eslint-disable-next-line no-var
  var __traceDb: TraceDb | undefined;
  // eslint-disable-next-line no-var
  var __traceDemo: { demo: Demo; day: string } | undefined;
}

export function db(): TraceDb {
  if (isDemo) return demo().db;
  if (!globalThis.__traceDb) globalThis.__traceDb = getDb(TRACE_DB_PATH);
  return globalThis.__traceDb;
}

// Rebuilt once a day, since the demo's sessions are dated relative to now.
export function demo(): Demo {
  const day = new Date().toISOString().slice(0, 10);
  if (globalThis.__traceDemo?.day !== day) {
    globalThis.__traceDemo?.demo.db.sqlite.close();
    globalThis.__traceDemo = { demo: buildDemo(new Date()), day };
  }
  return globalThis.__traceDemo.demo;
}
