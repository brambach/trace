import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPullRequest, prSupport, type Fix } from '../src/index.js';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();

describe('openPullRequest', () => {
  it('commits the line on a new branch from a worktree and leaves your checkout alone', () => {
    const root = mkdtempSync(join(tmpdir(), 'trace-pr-test-'));
    // A bare repo whose path looks like GitHub, and a gh stub that prints a URL.
    const remote = join(root, 'github.com', 'me', 'acme.git');
    mkdirSync(remote, { recursive: true });
    git(remote, 'init', '--bare', '-b', 'main');
    const repo = join(root, 'acme');
    mkdirSync(repo);
    git(repo, 'init', '-b', 'main');
    writeFileSync(join(repo, 'CLAUDE.md'), '# acme\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-m', 'init');
    git(repo, 'remote', 'add', 'origin', remote);
    git(repo, 'push', '-u', 'origin', 'main');
    writeFileSync(join(repo, 'wip.txt'), 'uncommitted\n');

    const bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'gh'), '#!/bin/sh\nif [ "$1" = "pr" ]; then echo https://github.com/me/acme/pull/7; fi\nexit 0\n');
    chmodSync(join(bin, 'gh'), 0o755);
    const path = process.env.PATH;
    process.env.PATH = `${bin}:${path}`;
    process.env.GIT_AUTHOR_NAME = 't';
    process.env.GIT_AUTHOR_EMAIL = 't@t';
    process.env.GIT_COMMITTER_NAME = 't';
    process.env.GIT_COMMITTER_EMAIL = 't@t';

    try {
      const fix = {
        id: 'abc123',
        kind: 'package-manager',
        key: 'pm:pnpm',
        line: 'Use pnpm.',
        habit: 'pnpm, not npm',
        said: 'use pnpm',
        times: 2,
        sessions: 2,
        projects: ['acme'],
        target: { scope: 'project', cwd: repo, path: join(repo, 'CLAUDE.md') },
        evidence: [],
        first_seen: '',
        last_seen: '',
        needles: ['pnpm'],
      } satisfies Fix;
      expect(prSupport(fix).ok).toBe(true);
      expect(openPullRequest(fix)).toBe('https://github.com/me/acme/pull/7');

      const branch = git(remote, 'branch', '--list', 'trace/*').replace('*', '').trim();
      expect(branch).toMatch(/^trace\/pnpm-not-npm-abc123$/u);
      expect(git(remote, 'show', `${branch}:CLAUDE.md`)).toBe('# acme\n\n## Notes from Trace\n\n- Use pnpm.');
      // Your checkout is untouched: same branch, same file, uncommitted work still there.
      expect(git(repo, 'branch', '--show-current')).toBe('main');
      expect(readFileSync(join(repo, 'CLAUDE.md'), 'utf8')).toBe('# acme\n');
      expect(readFileSync(join(repo, 'wip.txt'), 'utf8')).toBe('uncommitted\n');
      expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
    } finally {
      process.env.PATH = path;
    }
  });
});
