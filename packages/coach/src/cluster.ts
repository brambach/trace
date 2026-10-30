import { homedir } from 'node:os';
import { join } from 'node:path';
import { findCorrections } from './corrections.js';
import { rulesFor } from './rules.js';
import { hash, jaccard } from './words.js';
import type { Correction, Evidence, Fix, FixTarget, Rule, SessionTimeline } from './types.js';

interface Hit {
  correction: Correction;
  rule: Rule;
}

export interface CoachOptions {
  // Where a fix that spans projects goes. Defaults to ~/.claude/CLAUDE.md.
  globalPath?: string;
  // A habit has to show up in at least this many sessions to earn a fix.
  minSessions?: number;
}

export interface CoachResult {
  fixes: Fix[];
  corrections: Correction[];
  // Correction message id to the fix it fed, for replay and the letter.
  fixByMessage: Map<string, string>;
}

export function coach(sessions: SessionTimeline[], opts: CoachOptions = {}): CoachResult {
  const minSessions = opts.minSessions ?? 2;
  const globalPath = opts.globalPath ?? join(homedir(), '.claude', 'CLAUDE.md');

  const corrections = sessions.flatMap(findCorrections);
  const hits: Hit[] = corrections.flatMap((c) => rulesFor(c).map((rule) => ({ correction: c, rule })));

  const groups = groupHits(hits);
  const fixes: Fix[] = [];
  const fixByMessage = new Map<string, string>();

  for (const group of groups) {
    const sessionIds = new Set(group.map((h) => h.correction.sessionId));
    if (sessionIds.size < minSessions) continue;

    const target = targetFor(group, globalPath);
    const first = group[0]!.rule;
    const key = first.kind === 'your-words' ? `say:${hash(group.map((h) => h.rule.key).sort()[0]!)}` : first.key;
    const id = hash(`${key}@${target.path}`);
    const sorted = [...group].sort((a, b) => a.correction.timestamp.localeCompare(b.correction.timestamp));
    const evidence: Evidence[] = sorted.map(({ correction: c, rule }) => ({
      sessionId: c.sessionId,
      messageId: c.messageId,
      timestamp: c.timestamp,
      project_name: c.project_name,
      quote: c.text,
      did: rule.did,
      via: c.via,
    }));
    const { line, habit } = compose(group);

    fixes.push({
      id,
      kind: first.kind,
      key,
      line,
      habit,
      times: group.length,
      sessions: sessionIds.size,
      projects: [...new Set(group.map((h) => h.correction.project_name))],
      target,
      evidence,
      first_seen: sorted[0]!.correction.timestamp,
      last_seen: sorted.at(-1)!.correction.timestamp,
      needles: [...new Set(group.flatMap((h) => h.rule.needles))],
    });
    for (const h of group) fixByMessage.set(h.correction.messageId, id);
  }

  const weight = { 'package-manager': 2, command: 1, 'your-words': 0 } as const;
  fixes.sort((a, b) => b.times - a.times || weight[b.kind] - weight[a.kind] || b.last_seen.localeCompare(a.last_seen));
  return { fixes, corrections, fixByMessage };
}

function groupHits(hits: Hit[]): Hit[][] {
  const exact = new Map<string, Hit[]>();
  const loose: Hit[] = [];
  for (const h of hits) {
    if (h.rule.kind === 'your-words') {
      loose.push(h);
      continue;
    }
    const list = exact.get(h.rule.key) ?? [];
    list.push(h);
    exact.set(h.rule.key, list);
  }

  // Your-words rules merge when they share most of their content words and
  // point the same way ("never X" and "always X" stay apart).
  const parent = loose.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const tokens = loose.map((h) => h.rule.key.split(':')[2]!.split(' '));
  const polarity = loose.map((h) => h.rule.key.split(':')[1]);
  for (let i = 0; i < loose.length; i++) {
    for (let j = i + 1; j < loose.length; j++) {
      if (polarity[i] !== polarity[j]) continue;
      const { score, shared } = jaccard(tokens[i]!, tokens[j]!);
      if (score >= 0.5 && shared >= 2) parent[find(i)] = find(j);
    }
  }
  const byRoot = new Map<number, Hit[]>();
  loose.forEach((h, i) => {
    const r = find(i);
    byRoot.set(r, [...(byRoot.get(r) ?? []), h]);
  });

  return [...exact.values(), ...byRoot.values()];
}

function targetFor(group: Hit[], globalPath: string): FixTarget {
  const cwds = new Set(group.map((h) => h.correction.cwd).filter((c) => c !== ''));
  if (cwds.size === 1) {
    const cwd = [...cwds][0]!;
    return { scope: 'project', cwd, path: join(cwd, 'CLAUDE.md') };
  }
  return { scope: 'global', cwd: null, path: globalPath };
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values.at(-1)!;
  for (const [v, n] of counts) if (n > (counts.get(best) ?? 0)) best = v;
  return best;
}

function compose(group: Hit[]): { line: string; habit: string } {
  const rule = group[0]!.rule;
  if (rule.kind === 'package-manager') {
    const desired = rule.key.slice('pm:'.length);
    const rejected = [...new Set(group.map((h) => h.rule.line))];
    const never = rejected.length === 1 ? rejected[0] : `${rejected.slice(0, -1).join(', ')} or ${rejected.at(-1)}`;
    const example = ['pnpm', 'yarn', 'bun', 'npm'].includes(desired)
      ? ` (\`${desired} install\`, \`${desired} run <script>\`)`
      : '';
    return {
      line: `Use ${desired} for installs and scripts${example}. Never ${never}.`,
      habit: `${desired}, not ${never}`,
    };
  }
  if (rule.kind === 'command') {
    const purpose = rule.key.slice('cmd:'.length);
    const cmd = mostCommon(group.map((h) => h.rule.line));
    return { line: `Run ${purpose} with \`${cmd}\`.`, habit: `How to run ${purpose}` };
  }
  // Your own words, shortest version, since it was probably the clearest.
  // A line that opens on a verb ("Don't add...") beats one that opens "No...".
  const line = [...group.map((h) => h.rule.line)].sort(
    (a, b) => Number(a.startsWith('No ')) - Number(b.startsWith('No ')) || a.length - b.length,
  )[0]!;
  return { line, habit: line.replace(/\.$/u, '') };
}
