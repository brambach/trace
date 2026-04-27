import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { TraceDb } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrations = ['0000_init.sql'];

export function migrate(db: TraceDb): void {
  for (const file of migrations) {
    const sql = readFileSync(join(here, 'migrations', file), 'utf8');
    db.sqlite.exec(sql);
  }
}
