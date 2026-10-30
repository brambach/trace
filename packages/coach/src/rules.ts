import { commandOf } from './tools.js';
import { contentTokens } from './words.js';
import type { Correction, Rule, ToolUse } from './types.js';

const JS_PMS = ['pnpm', 'npm', 'yarn', 'bun'] as const;
const PY_PMS = ['uv', 'poetry', 'pip'] as const;
const PM_ALIASES: Record<string, string> = { npx: 'npm', pnpx: 'pnpm', bunx: 'bun', pip3: 'pip' };
const PM_WORD = '(pnpm|npm|yarn|bun|uv|poetry|pip3?|npx|pnpx|bunx)';

const RUNNERS = new Set([
  'pnpm', 'npm', 'yarn', 'bun', 'npx', 'pnpx', 'bunx', 'make', 'cargo', 'go', 'pytest', 'python', 'python3',
  'uv', 'poetry', 'just', 'deno', 'bundle', 'rake', 'mix', 'gradle', './gradlew', 'mvn', 'dotnet', 'swift',
  'xcodebuild', 'composer', 'turbo', 'nx', 'vitest', 'jest', 'tsc', 'ruff', 'docker',
]);

type Purpose = 'tests' | 'type checks' | 'the linter' | 'the build' | 'the dev server' | 'formatting' | 'migrations';

const PURPOSES: [Purpose, RegExp][] = [
  ['tests', /\b(?:test|tests|vitest|jest|pytest|spec|rspec|e2e)\b/u],
  ['type checks', /\b(?:typecheck|type-check|tsc|mypy|pyright)\b/u],
  ['the linter', /\b(?:lint|eslint|ruff|clippy|rubocop)\b/u],
  ['the build', /\bbuild\b/u],
  ['the dev server', /\b(?:dev|serve|start)\b/u],
  ['formatting', /\b(?:format|fmt|prettier|black)\b/u],
  ['migrations', /\bmigrat/u],
];

export function rulesFor(c: Correction): Rule[] {
  const pm = packageManagerRule(c);
  const cmd = commandRule(c, pm?.explicit ?? false);
  const rules: Rule[] = [];
  // "no, `pnpm vitest run`" after "npx jest" is about the test command. Only
  // keep the package manager rule too when you named both managers.
  if (pm && (pm.explicit || !cmd)) rules.push(pm.rule);
  if (cmd) rules.push(cmd);
  if (rules.length === 0) rules.push(...yourWordsRules(c));
  return rules;
}

// "pnpm add dayjs" typed right after the agent ran "yarn add dayjs" is a
// correction even with no redirect words in it.
export function switchedPackageManager(text: string, before: ToolUse[]): boolean {
  return packageManagerRule({ text, before }) !== null;
}

function normPm(w: string): string {
  const l = w.toLowerCase();
  return PM_ALIASES[l] ?? l;
}

function familyOf(pm: string): readonly string[] {
  return (JS_PMS as readonly string[]).includes(pm) ? JS_PMS : PY_PMS;
}

function pmsRun(before: ToolUse[]): { pm: string; command: string }[] {
  const out: { pm: string; command: string }[] = [];
  for (const t of before) {
    const cmd = commandOf(t);
    if (!cmd) continue;
    for (const seg of cmd.split(/&&|\|\||;|\|/u)) {
      const first = seg.trim().split(/\s+/u)[0] ?? '';
      const pm = normPm(first);
      if ([...JS_PMS, ...PY_PMS].includes(pm as never)) out.push({ pm, command: seg.trim() });
    }
  }
  return out;
}

function packageManagerRule(c: Pick<Correction, 'text' | 'before'>): { rule: Rule; explicit: boolean } | null {
  const t = c.text.toLowerCase();
  let desired: string | null = null;
  let rejected: string | null = null;

  const notThen = new RegExp(`\\bnot\\s+${PM_WORD}\\b[\\s,;.]*(?:use\\s+|it'?s\\s+)?${PM_WORD}\\b`, 'u').exec(t);
  const thenNot = new RegExp(`\\b${PM_WORD}\\b[\\s,]*(?:not|instead of|rather than)\\s+${PM_WORD}\\b`, 'u').exec(t);
  const useIt = new RegExp(`\\b(?:use|using|with|switch to|we use|it'?s a|this is a|via)\\s+${PM_WORD}\\b`, 'u').exec(t);

  if (thenNot) [desired, rejected] = [normPm(thenNot[1]!), normPm(thenNot[2]!)];
  else if (notThen) [rejected, desired] = [normPm(notThen[1]!), normPm(notThen[2]!)];
  else if (useIt) desired = normPm(useIt[1]!);
  const explicit = desired !== null;

  const ran = pmsRun(c.before);
  if (!desired) {
    // A bare "pnpm install" typed right after the agent ran "npm install".
    const mentioned = [...new Set((t.match(new RegExp(`\\b${PM_WORD}\\b`, 'gu')) ?? []).map(normPm))];
    if (mentioned.length === 1 && ran.some((r) => r.pm !== mentioned[0] && familyOf(r.pm) === familyOf(mentioned[0]!))) {
      desired = mentioned[0]!;
    }
  }
  if (!desired) return null;

  const wrongRun = ran.filter((r) => r.pm !== desired && familyOf(r.pm) === familyOf(desired));
  if (!rejected) rejected = wrongRun.at(-1)?.pm ?? null;
  if (!rejected || rejected === desired || familyOf(rejected) !== familyOf(desired)) return null;

  const did = wrongRun.at(-1) ? `ran \`${clip(wrongRun.at(-1)!.command)}\`` : null;
  return {
    explicit,
    rule: {
      kind: 'package-manager',
      key: `pm:${desired}`,
      // The rejected manager. The cluster turns these into the final line.
      line: rejected,
      habit: `${desired}, not ${rejected}`,
      did,
      needles: [desired],
    },
  };
}

function purposeOf(cmd: string): Purpose | null {
  for (const [p, re] of PURPOSES) if (re.test(cmd)) return p;
  return null;
}

function commandsIn(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/`([^`\n]+)`/gu)) {
    const cmd = m[1]!.trim();
    if (RUNNERS.has(cmd.split(/\s+/u)[0]!)) found.push(cmd);
  }
  if (found.length > 0) return found;
  for (const m of text.matchAll(/\b(?:run|use|it'?s|try)\s+((?:\.\/)?[a-z0-9][\w./:-]*(?:\s+[\w./:=-]+){0,3})/giu)) {
    const words = m[1]!.split(/\s+/u);
    const stop = words.findIndex((w) => /^(?:not|instead|and|to|then|first|please|again|for)$/iu.test(w));
    const cmd = (stop === -1 ? words : words.slice(0, stop)).join(' ').replace(/[.,;!?]+$/u, '');
    if (RUNNERS.has(cmd.split(/\s+/u)[0]!) && cmd.split(/\s+/u).length >= 2) found.push(cmd);
  }
  return found;
}

function stripPm(cmd: string): string {
  return cmd.replace(new RegExp(`^${PM_WORD}\\s+(?:run\\s+)?`, 'u'), '').trim();
}

function commandRule(c: Correction, hasPmRule: boolean): Rule | null {
  const wanted = commandsIn(c.text);
  for (const cmd of wanted) {
    const purpose = purposeOf(cmd);
    if (!purpose) continue;
    const ran = c.before
      .map(commandOf)
      .filter((x): x is string => x !== null && purposeOf(x) === purpose);
    const wrong = ran.filter((r) => r.trim() !== cmd);
    const redirect = /\b(?:not|instead|use|run|always|i said)\b/iu.test(c.text);
    if (wrong.length === 0 && !redirect) continue;
    // "pnpm test, not npm test" is the package manager rule, not a new command.
    if (hasPmRule && wrong.length > 0 && wrong.every((w) => stripPm(w) === stripPm(cmd))) continue;
    return {
      kind: 'command',
      key: `cmd:${purpose}`,
      line: cmd,
      habit: `How to run ${purpose}`,
      did: wrong.at(-1) ? `ran \`${clip(wrong.at(-1)!)}\`` : null,
      needles: [cmd],
    };
  }
  return null;
}

const DIRECTIVE_RE = /\b(?:don'?t|do not|never|always|stop|avoid|keep|use|prefer|only|no more|leave)\b|^no\s+\w/iu;
const NEGATIVE_RE = /\b(?:don'?t|do not|never|stop|avoid|no|not)\b/iu;
// "no, use X" loses its "no"; "no comments" keeps it, since there it's the point.
const LEAD_IN_RE =
  /^(?:(?:no|nope)[,.!:]+|(?:actually|wait|again|ok(?:ay)?|please|hey|and|but|so|also|i said|i told you|like i said|as i said|remember)\b[,.!:]*)\s*/iu;

export function cleanDirective(sentence: string): string | null {
  let s = sentence.trim();
  for (let i = 0; i < 4; i++) s = s.replace(LEAD_IN_RE, '').trim();
  s = s
    .replace(/(?:[,\s]+(?:again|please|ok|okay))+[.!]*$/iu, '')
    .replace(/[.!]+$/u, '')
    .trim();
  if (s.includes('?')) return null;
  const words = s.split(/\s+/u).length;
  if (words < 3 || words > 22) return null;
  if (!DIRECTIVE_RE.test(s)) return null;
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

function yourWordsRules(c: Correction): Rule[] {
  const rules: Rule[] = [];
  for (const raw of c.text.split(/(?<=[.!?])\s+|\n+/u)) {
    const line = cleanDirective(raw);
    if (!line) continue;
    const tokens = contentTokens(line);
    if (tokens.length < 2) continue;
    const polarity = NEGATIVE_RE.test(line) ? 'never' : 'do';
    rules.push({
      kind: 'your-words',
      key: `say:${polarity}:${[...tokens].sort().join(' ')}`,
      line,
      habit: line,
      did: lastAction(c.before),
      needles: tokens,
    });
  }
  return rules;
}

function lastAction(before: ToolUse[]): string | null {
  const t = before.at(-1);
  if (!t) return null;
  const cmd = commandOf(t);
  if (cmd) return `ran \`${clip(cmd)}\``;
  const file = t.input.file_path ?? t.input.path ?? t.input.pattern;
  const verb: Record<string, string> = { Edit: 'edited', Write: 'wrote', MultiEdit: 'edited', Read: 'read', Grep: 'searched for', Glob: 'looked for' };
  if (typeof file === 'string' && verb[t.name]) return `${verb[t.name]} \`${clip(shortPath(file))}\``;
  return `used ${t.name}`;
}

function shortPath(p: string): string {
  const parts = p.split('/');
  return parts.length > 3 ? parts.slice(-3).join('/') : p;
}

function clip(s: string, n = 60): string {
  const one = s.replace(/\s+/gu, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}
