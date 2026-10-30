import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { applyEdit, planEdit, readIfExists } from './claude-md.js';
import type { Fix } from './types.js';

export class PullRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PullRequestError';
  }
}

function run(cmd: string, args: string[], cwd: string): string {
  try {
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    throw new PullRequestError(`${cmd} ${args[0] ?? ''} failed: ${(e.stderr ?? e.message).trim().split('\n')[0]}`);
  }
}

export interface PrSupport {
  ok: boolean;
  reason?: string;
  root?: string;
}

// A fix can go out as a PR when its project is a git repo with a GitHub
// remote and the gh CLI is signed in.
export function prSupport(fix: Fix): PrSupport {
  if (fix.target.scope !== 'project' || !fix.target.cwd) return { ok: false, reason: 'Global fixes are local only.' };
  try {
    const root = run('git', ['rev-parse', '--show-toplevel'], fix.target.cwd);
    const remote = run('git', ['remote', 'get-url', 'origin'], root);
    if (!/github\.com[:/]/u.test(remote)) return { ok: false, reason: 'origin is not on GitHub.' };
    run('gh', ['auth', 'status'], root);
    return { ok: true, root };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'No git repo here.' };
  }
}

// Opens the fix as a PR from a throwaway worktree, so your checkout, branch
// and uncommitted changes are never touched.
export function openPullRequest(fix: Fix): string {
  const support = prSupport(fix);
  if (!support.ok || !support.root) throw new PullRequestError(support.reason ?? 'Cannot open a PR here.');
  const root = support.root;

  let base = 'main';
  try {
    base = run('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], root).replace(/^origin\//u, '');
  } catch {
    // origin/HEAD isn't set on every clone. main is the common default.
  }
  run('git', ['fetch', 'origin', base], root);

  const branch = `trace/${slug(fix.habit)}-${fix.id.slice(0, 6)}`;
  const dir = mkdtempSync(join(tmpdir(), 'trace-pr-'));
  rmSync(dir, { recursive: true, force: true });
  run('git', ['worktree', 'add', '-b', branch, dir, `origin/${base}`], root);
  try {
    const rel = relative(root, fix.target.path);
    const path = join(dir, rel);
    applyEdit(planEdit(path, fix.line, readIfExists(path)));
    run('git', ['add', rel], dir);
    run('git', ['commit', '-m', `docs: add a CLAUDE.md note from Trace\n\n${fix.line}`], dir);
    run('git', ['push', '-u', 'origin', branch], dir);
    const body = [
      `Adds one line to \`${rel}\`:`,
      '',
      `> ${fix.line}`,
      '',
      `You corrected the agent on this ${fix.times} times across ${fix.sessions} sessions. For example:`,
      '',
      ...fix.evidence.slice(-3).map((e) => `- "${oneLine(e.quote)}"${e.did ? ` (after it ${e.did})` : ''}`),
      '',
      'Drafted by [Trace](https://github.com/brambach/trace) from your local sessions.',
    ].join('\n');
    return run('gh', ['pr', 'create', '--base', base, '--head', branch, '--title', `CLAUDE.md: ${fix.habit}`, '--body', body], dir)
      .split('\n')
      .at(-1)!;
  } finally {
    try {
      run('git', ['worktree', 'remove', '--force', dir], root);
    } catch {
      // Leaving a stray worktree is better than hiding the real error.
    }
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 40);
}

function oneLine(s: string): string {
  const t = s.replace(/\s+/gu, ' ').trim();
  return t.length > 140 ? `${t.slice(0, 139)}…` : t;
}
