import { cache } from 'react';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { coach, isCovered, prSupport, readIfExists, type Fix, type CoachResult } from '@trace/coach';
import { getFixDecisions, loadTimelines, type FixDecision } from '@trace/db';
import { DEMO_HOME } from '@trace/demo';
import type { SessionTimeline } from '@trace/shared';
import { db, demo } from './db';
import { isDemo } from './mode';

export type FixState = 'waiting' | 'applied' | 'covered' | 'dismissed';

export interface FixView {
  fix: Fix;
  state: FixState;
  decision: FixDecision | null;
  // Corrections in this habit after you applied the fix. Zero means it held.
  saidSince: number;
  pr: { ok: boolean; reason?: string };
}

export interface CoachView extends CoachResult {
  timelines: SessionTimeline[];
  views: FixView[];
  waiting: number;
}

export const HOME_DIR = isDemo ? DEMO_HOME : homedir();
const WINDOW_DAYS = 60;

export function readClaudeMd(path: string): string | null {
  return isDemo ? (demo().files.get(path) ?? null) : readIfExists(path);
}

// What the agent already reads in a project: CLAUDE.md in its two homes,
// plus AGENTS.md for Codex.
function instructionsFor(fix: Fix): string {
  const paths = [fix.target.path];
  if (fix.target.scope === 'project' && fix.target.cwd) {
    paths.push(join(fix.target.cwd, '.claude', 'CLAUDE.md'), join(fix.target.cwd, 'AGENTS.md'));
  }
  return paths.map((p) => readClaudeMd(p) ?? '').join('\n');
}

export const getCoach = cache((): CoachView => {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const timelines = loadTimelines(db(), { sinceIso: since });
  const result = coach(timelines, { globalPath: join(HOME_DIR, '.claude', 'CLAUDE.md') });
  const decisions = getFixDecisions(db());

  const views: FixView[] = result.fixes.map((fix) => {
    const decision = decisions.get(fix.id) ?? null;
    const saidSince = decision ? fix.evidence.filter((e) => e.timestamp > decision.decided_at).length : 0;
    let state: FixState;
    if (decision?.status === 'applied') state = 'applied';
    else if (decision?.status === 'dismissed') state = 'dismissed';
    else state = isCovered(fix, instructionsFor(fix)) ? 'covered' : 'waiting';
    const pr = isDemo
      ? { ok: fix.target.scope === 'project', reason: 'Global fixes are local only.' }
      : state === 'waiting'
        ? prSupport(fix)
        : { ok: false };
    return { fix, state, decision, saidSince, pr };
  });

  return { ...result, timelines, views, waiting: views.filter((v) => v.state === 'waiting').length };
});

export function displayPath(path: string): string {
  return path.startsWith(HOME_DIR) ? `~${path.slice(HOME_DIR.length)}` : path;
}

export function projectDirName(path: string): string {
  return dirname(path).split('/').at(-1) ?? path;
}
