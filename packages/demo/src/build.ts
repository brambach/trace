import { coach, hash, planEdit, type SessionTimeline } from '@trace/coach';
import { getDb, loadTimelines, recordFixDecision, type TraceDb } from '@trace/db';
import { ingestLines, type SourceLine } from '@trace/ingest';
import type { Script, Step, Tool } from './dsl.js';
import { filler, scripts } from './scripts.js';

export const DEMO_HOME = '/Users/you';
const DAY = 86_400_000;

export interface DemoFile {
  path: string;
  lines: string[];
}

export interface Demo {
  db: TraceDb;
  // CLAUDE.md files as they'd be on the made-up machine.
  files: Map<string, string>;
}

// Builds the demo database in memory from made-up sessions, dated relative
// to `now` so Today always has something in it. Every line goes through the
// same parser and inserts as real session files.
export function buildDemo(now: Date = new Date()): Demo {
  const db = getDb(':memory:');
  const files = demoFiles(now);
  db.sqlite.transaction(() => {
    for (const f of files) {
      let offset = 0;
      const lines: SourceLine[] = f.lines.map((text) => {
        const l = { text, offset };
        offset += Buffer.byteLength(text, 'utf8') + 1;
        return l;
      });
      ingestLines(db, f.path, lines);
    }
  })();

  // The pnpm fix was applied eight days ago, so the demo can show a fix that
  // worked: you haven't had to say it since.
  const claudeMd = new Map<string, string>([
    [`${DEMO_HOME}/code/ledger/CLAUDE.md`, '# ledger\n\nPersonal budgeting app. Next 15, Drizzle, SQLite.\n'],
    [`${DEMO_HOME}/code/fieldnotes/CLAUDE.md`, '# fieldnotes\n\nMy blog. Astro, MDX, deployed on push to main.\n'],
  ]);
  const appliedAt = new Date(startOfDay(now) - 8 * DAY + 11 * 3_600_000).toISOString();
  const timelines: SessionTimeline[] = loadTimelines(db, {}).map((t) => ({
    ...t,
    events: t.events.filter((e) => e.timestamp < appliedAt),
  }));
  const pnpm = coach(timelines, { globalPath: `${DEMO_HOME}/.claude/CLAUDE.md` }).fixes.find((f) => f.key === 'pm:pnpm');
  if (pnpm) {
    recordFixDecision(db, {
      id: pnpm.id,
      rule_key: pnpm.key,
      target_path: pnpm.target.path,
      line: pnpm.line,
      status: 'applied',
      how: 'local',
      pr_url: null,
      decided_at: appliedAt,
    });
    claudeMd.set(pnpm.target.path, planEdit(pnpm.target.path, pnpm.line, claudeMd.get(pnpm.target.path) ?? null).after);
  }
  return { db, files: claudeMd };
}

function startOfDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function demoFiles(now: Date): DemoFile[] {
  const rand = mulberry32(7);
  const all: Script[] = [...scripts, ...fillerScripts(rand)];

  // Today's sessions end shortly before now, newest last, spaced to fit
  // between midnight and now when they can.
  const today = all.filter((s) => s.day === 0);
  const room = now.getTime() - startOfDay(now) - 30 * 60_000;
  const busy = today.reduce((sum, s) => sum + duration(s) * 1000, 0);
  const gap = Math.max(4 * 60_000, Math.min(55 * 60_000, (room - busy) / Math.max(1, today.length)));
  let cursor = now.getTime() - 12 * 60_000;
  const todayStart = new Map<string, number>();
  for (const s of [...today].reverse()) {
    const start = cursor - duration(s) * 1000;
    todayStart.set(s.id, start);
    cursor = start - gap;
  }

  return all.map((s) => {
    const start =
      todayStart.get(s.id) ?? startOfDay(now) + s.day * DAY + s.at * 3_600_000 + Math.floor(rand() * 40) * 60_000;
    return s.agent === 'codex' ? codexFile(s, start) : claudeFile(s, start);
  });
}

function duration(s: Script): number {
  return s.steps.reduce((sum, st) => sum + st.wait + (st.t === 'agent' ? st.tools.length * 6 : 0), 0);
}

function cwdOf(s: Script): string {
  return `${DEMO_HOME}/code/${s.project}`;
}

function uuid(seed: string): string {
  const h = [0, 1, 2, 3].map((i) => hash(`${seed}:${i}`)).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function claudeFile(s: Script, startMs: number): DemoFile {
  const sessionId = uuid(s.id);
  const cwd = cwdOf(s);
  const lines: string[] = [];
  let t = startMs;
  let n = 0;
  let parent: string | null = null;
  const base = () => ({ sessionId, cwd, gitBranch: 'main', version: '2.1.0' });
  const push = (type: 'user' | 'assistant', content: unknown) => {
    const id = uuid(`${s.id}:${n++}`);
    lines.push(
      JSON.stringify({ type, ...base(), uuid: id, parentUuid: parent, timestamp: new Date(t).toISOString(), message: { role: type, content } }),
    );
    parent = id;
  };

  let lastTool: string | null = null;
  for (const st of s.steps) {
    t += st.wait * 1000;
    if (st.t === 'you') push('user', st.text);
    else if (st.t === 'interrupt') push('user', [{ type: 'text', text: '[Request interrupted by user]' }]);
    else if (st.t === 'reject') {
      push('user', [
        {
          type: 'tool_result',
          tool_use_id: lastTool ?? 'none',
          is_error: true,
          content: `The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). The user provided the following reason for the rejection: ${st.reason}`,
        },
      ]);
    } else {
      push('assistant', [{ type: 'text', text: st.text }]);
      for (const tool of st.tools) {
        t += 6000;
        const id = `toolu_${hash(`${s.id}:${n}:${tool.name}`)}`;
        push('assistant', [{ type: 'tool_use', id, name: tool.name, input: tool.input }]);
        lastTool = id;
        if (!isRejectedNext(s.steps, st, tool)) {
          push('user', [{ type: 'tool_result', tool_use_id: id, content: tool.result ?? 'ok' }]);
        }
      }
    }
  }
  lines.push(JSON.stringify({ type: 'ai-title', sessionId, aiTitle: s.title }));
  return { path: `${DEMO_HOME}/.claude/projects/${cwd.replaceAll('/', '-')}/${sessionId}.jsonl`, lines };
}

// The last tool before a rejection never got a result; the rejection is its result.
function isRejectedNext(steps: Step[], st: Step, tool: Tool): boolean {
  const i = steps.indexOf(st);
  if (st.t !== 'agent') return false;
  return steps[i + 1]?.t === 'reject' && st.tools.at(-1) === tool;
}

function codexFile(s: Script, startMs: number): DemoFile {
  const sessionId = uuid(s.id);
  const cwd = cwdOf(s);
  const lines: string[] = [];
  let t = startMs;
  const at = () => new Date(t).toISOString();
  const item = (payload: unknown) => lines.push(JSON.stringify({ timestamp: at(), type: 'response_item', payload }));

  lines.push(JSON.stringify({ timestamp: at(), type: 'session_meta', payload: { id: sessionId, timestamp: at(), cwd, originator: 'codex_cli_rs', cli_version: '0.50.0', git: { branch: 'main' } } }));
  item({ type: 'message', role: 'user', content: [{ type: 'input_text', text: `<environment_context>\n  <cwd>${cwd}</cwd>\n</environment_context>` }] });
  let call = 0;
  for (const st of s.steps) {
    t += st.wait * 1000;
    if (st.t === 'you') item({ type: 'message', role: 'user', content: [{ type: 'input_text', text: st.text }] });
    else if (st.t === 'agent') {
      item({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: st.text }] });
      for (const tool of st.tools) {
        t += 6000;
        const call_id = `call_${hash(`${s.id}:${call++}`)}`;
        if (tool.name === 'Bash') {
          item({ type: 'function_call', name: 'shell', call_id, arguments: JSON.stringify({ command: ['bash', '-lc', tool.input.command] }) });
        } else if (tool.name === 'Edit' || tool.name === 'Write') {
          item({ type: 'custom_tool_call', name: 'apply_patch', call_id, input: `*** Begin Patch\n*** Update File: ${String(tool.input.file_path)}\n@@\n*** End Patch` });
        } else {
          item({ type: 'function_call', name: 'shell', call_id, arguments: JSON.stringify({ command: ['bash', '-lc', `sed -n 1,200p ${String(tool.input.file_path ?? '.')}`] }) });
        }
        item({ type: 'function_call_output', call_id, output: tool.result ?? 'ok' });
      }
    }
  }
  const d = new Date(startMs);
  const ymd = d.toISOString().slice(0, 10);
  const stamp = d.toISOString().slice(0, 19).replaceAll(':', '-');
  return { path: `${DEMO_HOME}/.codex/sessions/${ymd.replaceAll('-', '/')}/rollout-${stamp}-${sessionId}.jsonl`, lines };
}

const TEST_CMD: Record<string, string> = {
  ledger: 'pnpm vitest run',
  tidepool: 'xcodebuild test -scheme Tidepool -quiet',
  fieldnotes: 'pnpm build',
  relay: 'go test ./...',
};

function fillerScripts(rand: () => number): Script[] {
  const out: Script[] = [];
  let k = 0;
  for (let day = -20; day <= 0; day++) {
    const count = day === 0 ? 2 : Math.floor(rand() * 3) + (day % 7 === 0 || day % 7 === -1 ? 0 : 1);
    for (let i = 0; i < count; i++) {
      const f = filler[(k + Math.floor(rand() * 3)) % filler.length]!;
      const steps: Step[] = [];
      f.prompts.forEach((p, j) => {
        steps.push({ t: 'you', text: p, wait: j === 0 ? 0 : 40 + Math.floor(rand() * 120) });
        const touched = f.files.slice(0, 1 + Math.floor(rand() * f.files.length));
        steps.push({
          t: 'agent',
          text: j === 0 ? 'On it.' : 'Done.',
          tools: [
            { name: 'Read', input: { file_path: touched[0] } },
            ...touched.map((file) => ({ name: 'Edit', input: { file_path: file } })),
            { name: 'Bash', input: { command: TEST_CMD[f.project] }, result: 'passed' },
          ],
          wait: 30 + Math.floor(rand() * 90),
        });
      });
      out.push({ id: `fill-${k++}`, project: f.project, agent: f.agent, day, at: 9 + Math.floor(rand() * 12), title: f.title, steps });
    }
  }
  return out;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
