import type { ParsedEvent, ParsedToolCall } from '@trace/shared';
import { computeFeatures } from './features.js';
import { classifyUserContent } from './classify.js';

// Codex CLI writes one rollout file per session under ~/.codex/sessions/YYYY/MM/DD/.
// Each line is { timestamp, type, payload }. Messages and tool calls arrive as
// response_item payloads; the first line is session_meta with the cwd.

export interface CodexLineContext {
  sessionId: string;
  // Stable id for this line, derived from the file path and byte offset,
  // since Codex payloads carry no uuid of their own.
  lineId: string;
}

type Payload = Record<string, unknown>;

export function codexSessionIdFromPath(filePath: string): string | null {
  const m = /rollout-.*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/iu.exec(filePath);
  return m ? `codex-${m[1]!.toLowerCase()}` : null;
}

export function parseCodexLine(json: string, ctx: CodexLineContext): ParsedEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const line = raw as { timestamp?: unknown; type?: unknown; payload?: unknown };
  const timestamp = typeof line.timestamp === 'string' ? line.timestamp : null;
  const payload = (line.payload && typeof line.payload === 'object' ? line.payload : null) as Payload | null;
  if (!timestamp || !payload) return { kind: 'noise' };

  if (line.type === 'session_meta') {
    const git = (payload.git ?? {}) as Payload;
    return {
      kind: 'session-meta',
      sessionId: ctx.sessionId,
      agent: 'codex',
      timestamp,
      cwd: typeof payload.cwd === 'string' ? payload.cwd : '',
      gitBranch: typeof git.branch === 'string' ? git.branch : null,
    };
  }

  if (line.type !== 'response_item') return { kind: 'noise' };

  if (payload.type === 'message' && (payload.role === 'user' || payload.role === 'assistant')) {
    const text = contentText(payload.content);
    const role = payload.role;
    const kind = role === 'user' ? classifyUserContent(text, text, false).kind : 'reply';
    return message(ctx, timestamp, role, kind, payload.content, text, []);
  }

  if (payload.type === 'function_call' || payload.type === 'custom_tool_call' || payload.type === 'local_shell_call') {
    const call = toolCall(payload, ctx.lineId);
    if (!call) return { kind: 'noise' };
    return message(ctx, timestamp, 'assistant', 'reply', payload, `[tool: ${call.name}]`, [call]);
  }

  return { kind: 'noise' };
}

function message(
  ctx: CodexLineContext,
  timestamp: string,
  role: 'user' | 'assistant',
  messageKind: Extract<ParsedEvent, { kind: 'message' }>['messageKind'],
  contentRaw: unknown,
  text: string,
  toolCalls: ParsedToolCall[],
): ParsedEvent {
  return {
    kind: 'message',
    sessionId: ctx.sessionId,
    uuid: ctx.lineId,
    role,
    messageKind,
    agent: 'codex',
    timestamp,
    cwd: undefined,
    gitBranch: undefined,
    contentRaw,
    contentText: text,
    tokenCountEstimate: Math.ceil(text.length / 4),
    features: computeFeatures(text, messageKind === 'prompt' ? 'user' : 'assistant'),
    toolCalls,
  };
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((c: unknown) => {
      const b = c as { type?: unknown; text?: unknown };
      return (b.type === 'input_text' || b.type === 'output_text' || b.type === 'text') && typeof b.text === 'string'
        ? b.text
        : '';
    })
    .filter((t) => t !== '')
    .join('\n\n');
}

// Codex names its tools differently. Map the common ones onto Claude Code's
// names so everything downstream (replay, the coach) reads one vocabulary.
function toolCall(payload: Payload, fallbackId: string): ParsedToolCall | null {
  const id = typeof payload.call_id === 'string' ? payload.call_id : `${fallbackId}:call`;
  const name = typeof payload.name === 'string' ? payload.name : payload.type === 'local_shell_call' ? 'shell' : null;
  if (!name) return null;

  let args: unknown = {};
  if (typeof payload.arguments === 'string') {
    try {
      args = JSON.parse(payload.arguments);
    } catch {
      args = { raw: payload.arguments };
    }
  } else if (typeof payload.input === 'string') {
    args = { input: payload.input };
  } else if (payload.action && typeof payload.action === 'object') {
    args = payload.action;
  }

  if (name === 'shell' || name === 'container.exec' || name === 'exec_command') {
    return { id, name: 'Bash', arguments_json: JSON.stringify({ command: shellCommand(args) }) };
  }
  if (name === 'apply_patch') {
    const patch = typeof (args as Payload).input === 'string' ? ((args as Payload).input as string) : '';
    const file = /\*\*\* (?:Update|Add) File: (.+)/u.exec(patch)?.[1]?.trim() ?? '';
    return { id, name: 'Edit', arguments_json: JSON.stringify({ file_path: file }) };
  }
  return { id, name, arguments_json: JSON.stringify(args) };
}

function shellCommand(args: unknown): string {
  const a = args as { command?: unknown; cmd?: unknown };
  const cmd = a.command ?? a.cmd;
  if (typeof cmd === 'string') return cmd;
  if (Array.isArray(cmd)) {
    const parts = cmd.filter((p): p is string => typeof p === 'string');
    // ["bash", "-lc", "pnpm test"] is the usual shape. Keep the script.
    if (parts.length === 3 && /(?:^|\/)(?:ba|z)?sh$/u.test(parts[0]!) && parts[1]!.startsWith('-')) return parts[2]!;
    return parts.join(' ');
  }
  return '';
}
