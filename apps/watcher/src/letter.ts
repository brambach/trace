import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { buildLetter, coach, letterMarkdown, weekStartOf, isCovered, readIfExists, type FixStatus } from '@trace/coach';
import { getFixDecisions, loadTimelines, type TraceDb } from '@trace/db';
import { TRACE_LETTERS_DIR } from '@trace/shared';

// Writes this week's letter to ~/Trace/letters/<monday>.md and returns the path.
export function writeLetter(db: TraceDb, now: Date = new Date()): string {
  const since = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const timelines = loadTimelines(db, { sinceIso: since });
  const result = coach(timelines, { globalPath: join(homedir(), '.claude', 'CLAUDE.md') });
  const decisions = getFixDecisions(db);
  const status = new Map<string, FixStatus>(
    result.fixes.map((f) => {
      const d = decisions.get(f.id);
      const saidSince = d ? f.evidence.filter((e) => e.timestamp > d.decided_at).length : 0;
      const state = d ? d.status : isCovered(f, readIfExists(f.target.path) ?? '') ? 'covered' : 'waiting';
      return [f.id, { state, saidSince }];
    }),
  );
  const letter = buildLetter(timelines, result, status, weekStartOf(now));
  mkdirSync(TRACE_LETTERS_DIR, { recursive: true });
  const path = join(TRACE_LETTERS_DIR, `${letter.weekStart}.md`);
  writeFileSync(path, letterMarkdown(letter));
  return path;
}

// Friday from 5pm on, write the week's letter once.
export function maybeWriteFridayLetter(db: TraceDb, now: Date = new Date()): string | null {
  if (now.getDay() !== 5 || now.getHours() < 17) return null;
  const path = join(TRACE_LETTERS_DIR, `${weekStartOf(now).toISOString().slice(0, 10)}.md`);
  if (existsSync(path)) return null;
  return writeLetter(db, now);
}
