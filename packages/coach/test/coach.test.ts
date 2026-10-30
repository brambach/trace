import { describe, expect, it } from 'vitest';
import { coach, findCorrections, cleanDirective, isCovered, planEdit } from '../src/index.js';
import { bash, edit, session } from './helpers.js';

const acme = '/Users/me/code/acme';

describe('findCorrections', () => {
  it('skips the first prompt and plain follow-ups', () => {
    const s = session('s1', acme, [
      { you: "don't use any here, add the types" },
      { says: 'Done', tools: [edit('src/a.ts')] },
      { you: 'now add a test for it' },
      { says: 'Added' },
    ]);
    expect(findCorrections(s)).toEqual([]);
  });

  it('catches a redirect, an interrupt and a rejected tool call', () => {
    const s = session('s1', acme, [
      { you: 'install zod' },
      { says: '', tools: [bash('npm install zod')] },
      { you: 'no, use pnpm' },
      { says: '', tools: [bash('pnpm add zod')] },
      { interrupt: true },
      { you: 'add it to the web package only' },
      { says: '', tools: [bash('rm -rf node_modules')] },
      { reject: 'never delete node_modules' },
    ]);
    const found = findCorrections(s);
    expect(found.map((c) => c.via)).toEqual(['said', 'interrupt', 'rejection']);
    expect(found[0]!.before.map((t) => t.input.command)).toEqual(['npm install zod']);
  });

  it('pairs a reasonless rejection with the prompt that explains it', () => {
    const s = session('s1', acme, [
      { you: 'clean up' },
      { says: '', tools: [bash('git push --force')] },
      { reject: '' },
      { you: 'never force push' },
    ]);
    const [c] = findCorrections(s);
    expect(c?.text).toBe('never force push');
    expect(c?.via).toBe('interrupt');
    expect(c?.before[0]?.input.command).toBe('git push --force');
  });
});

describe('coach', () => {
  it('turns a repeated package manager correction into one fix', () => {
    const sessions = [
      session('s1', acme, [{ you: 'install zod' }, { tools: [bash('npm install zod')] }, { you: 'no, use pnpm' }]),
      session('s2', acme, [{ you: 'run the tests' }, { tools: [bash('npm test')] }, { you: 'pnpm not npm' }]),
      session('s3', acme, [{ you: 'add dayjs' }, { tools: [bash('yarn add dayjs')] }, { you: 'pnpm add dayjs' }]),
    ];
    const { fixes } = coach(sessions, { globalPath: '/g/CLAUDE.md' });
    expect(fixes).toHaveLength(1);
    const fix = fixes[0]!;
    expect(fix.kind).toBe('package-manager');
    expect(fix.times).toBe(3);
    expect(fix.line).toBe('Use pnpm for installs and scripts (`pnpm install`, `pnpm run <script>`). Never npm or yarn.');
    expect(fix.target).toEqual({ scope: 'project', cwd: acme, path: `${acme}/CLAUDE.md` });
    expect(fix.evidence[0]!.did).toBe('ran `npm install zod`');
  });

  it('needs the habit in two sessions, not one', () => {
    const s = session('s1', acme, [
      { you: 'install zod' },
      { tools: [bash('npm install zod')] },
      { you: 'no, use pnpm' },
      { tools: [bash('npm i')] },
      { you: 'I said pnpm, not npm' },
    ]);
    expect(coach([s]).fixes).toEqual([]);
  });

  it('learns the test command', () => {
    const mk = (id: string) =>
      session(id, acme, [
        { you: 'fix the date bug' },
        { tools: [edit('src/date.ts'), bash('npx jest')] },
        { you: 'we use vitest, run `pnpm vitest run` instead' },
      ]);
    const { fixes } = coach([mk('a'), mk('b')]);
    const cmd = fixes.find((f) => f.kind === 'command');
    expect(cmd?.line).toBe('Run tests with `pnpm vitest run`.');
  });

  it('clusters the same instruction said different ways, in your words', () => {
    const sessions = [
      session('a', acme, [{ you: 'refactor auth' }, { tools: [edit('src/auth.ts')] }, { you: "no. don't add comments that restate the code" }]),
      session('b', acme, [{ you: 'add retries' }, { tools: [edit('src/net.ts')] }, { you: 'again, stop adding comments that restate code' }]),
      session('c', acme, [{ you: 'add retries' }, { tools: [edit('src/net.ts')] }, { you: 'always add comments everywhere' }]),
    ];
    const { fixes } = coach(sessions);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]!.kind).toBe('your-words');
    expect(fixes[0]!.sessions).toBe(2);
    expect(fixes[0]!.line).toBe('Stop adding comments that restate code.');
  });

  it('sends a habit that spans projects to the global CLAUDE.md', () => {
    const mk = (id: string, cwd: string) =>
      session(id, cwd, [{ you: 'go' }, { tools: [bash('git push --force')] }, { you: 'never force push to main' }]);
    const { fixes } = coach([mk('a', acme), mk('b', '/Users/me/code/blog')], { globalPath: '/home/me/.claude/CLAUDE.md' });
    expect(fixes[0]!.target).toEqual({ scope: 'global', cwd: null, path: '/home/me/.claude/CLAUDE.md' });
  });
});

describe('cleanDirective', () => {
  it('strips lead-ins and trailing nags', () => {
    expect(cleanDirective('no, I said never use default exports again!')).toBe('Never use default exports.');
    expect(cleanDirective('why did you do that?')).toBeNull();
    expect(cleanDirective('stop')).toBeNull();
  });
});

describe('CLAUDE.md', () => {
  it('knows when a rule is already written down', () => {
    expect(isCovered({ kind: 'package-manager', needles: ['pnpm'] }, '# Repo\nUse pnpm.\n')).toBe(true);
    expect(isCovered({ kind: 'your-words', needles: ['comment', 'restate', 'code'] }, '- Skip comments that restate the code\n')).toBe(true);
    expect(isCovered({ kind: 'your-words', needles: ['comment', 'restate', 'code'] }, '- Write tests first\n')).toBe(false);
  });

  it('adds a Trace section once and appends to it after', () => {
    const first = planEdit('/x/CLAUDE.md', 'Use pnpm.', '# Acme\n\nSome notes.\n');
    expect(first.after).toBe('# Acme\n\nSome notes.\n\n## Notes from Trace\n\n- Use pnpm.\n');
    const second = planEdit('/x/CLAUDE.md', 'Run tests with `pnpm test`.', `${first.after}\n## Later\n\nstuff\n`);
    expect(second.added).toEqual(['- Run tests with `pnpm test`.']);
    expect(second.after).toContain('- Use pnpm.\n- Run tests with `pnpm test`.\n\n## Later');
    expect(planEdit('/x/CLAUDE.md', 'Use pnpm.', null).after).toBe('## Notes from Trace\n\n- Use pnpm.\n');
  });
});
