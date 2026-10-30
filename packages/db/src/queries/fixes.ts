import type { TraceDb } from '../client.js';

export interface FixDecision {
  id: string;
  rule_key: string;
  target_path: string;
  line: string;
  status: 'applied' | 'dismissed';
  how: 'local' | 'pr' | null;
  pr_url: string | null;
  decided_at: string;
}

export function getFixDecisions(db: TraceDb): Map<string, FixDecision> {
  const rows = db.sqlite.prepare<[], FixDecision>(`SELECT * FROM fixes`).all();
  return new Map(rows.map((r) => [r.id, r]));
}

export function recordFixDecision(db: TraceDb, d: FixDecision): void {
  db.sqlite
    .prepare(
      `INSERT INTO fixes (id, rule_key, target_path, line, status, how, pr_url, decided_at)
       VALUES (@id, @rule_key, @target_path, @line, @status, @how, @pr_url, @decided_at)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status, how = excluded.how, pr_url = excluded.pr_url,
         line = excluded.line, decided_at = excluded.decided_at`,
    )
    .run(d);
}

export function clearFixDecision(db: TraceDb, id: string): void {
  db.sqlite.prepare(`DELETE FROM fixes WHERE id = ?`).run(id);
}
