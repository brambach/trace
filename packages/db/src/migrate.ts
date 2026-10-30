import type { TraceDb } from './client.js';
import { init } from './migrations/0000-init.js';
import { coach } from './migrations/0001-coach.js';

// The SQL lives in modules, not .sql files, so bundlers ship it. The names keep
// their .sql suffix because existing databases recorded them that way.
const migrations: ReadonlyArray<readonly [string, string]> = [
  ['0000_init.sql', init],
  ['0001_coach.sql', coach],
];

// 0000 predates this table and is written to be rerun safely, so databases
// created before migrations were tracked pick it up as already applied.
export function migrate(db: TraceDb): void {
  db.sqlite.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const applied = new Set(
    db.sqlite
      .prepare<[], { name: string }>(`SELECT name FROM schema_migrations`)
      .all()
      .map((r) => r.name),
  );
  for (const [file, sql] of migrations) {
    if (applied.has(file)) continue;
    db.sqlite.transaction(() => {
      db.sqlite.exec(sql);
      db.sqlite
        .prepare(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, datetime('now'))`)
        .run(file);
    })();
  }
}
