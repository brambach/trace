import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { TraceDb } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrations = ['0000_init.sql', '0001_coach.sql'];

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
  for (const file of migrations) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(here, 'migrations', file), 'utf8');
    db.sqlite.transaction(() => {
      db.sqlite.exec(sql);
      db.sqlite
        .prepare(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, datetime('now'))`)
        .run(file);
    })();
  }
}
