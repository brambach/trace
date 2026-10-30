import type { SessionTimeline, TimelineEvent, ToolUse } from '../src/types.js';

let n = 0;

export function session(id: string, cwd: string, steps: Step[], day = '2026-10-26'): SessionTimeline {
  const events: TimelineEvent[] = steps.map((s, i) => {
    const timestamp = `${day}T10:${String(i).padStart(2, '0')}:00.000Z`;
    const base = { id: `${id}-m${i}-${n++}`, timestamp, tools: [] as ToolUse[] };
    if ('you' in s) return { ...base, role: 'user', kind: 'prompt', text: s.you };
    if ('interrupt' in s) return { ...base, role: 'user', kind: 'interrupt', text: '[Request interrupted by user]' };
    if ('reject' in s) return { ...base, role: 'user', kind: 'rejection', text: s.reject };
    return { ...base, role: 'assistant', kind: 'reply', text: s.says ?? '', tools: s.tools ?? [] };
  });
  return {
    id,
    cwd,
    project_name: cwd.split('/').at(-1)!,
    agent: 'claude',
    ai_title: null,
    started_at: events[0]!.timestamp,
    ended_at: events.at(-1)!.timestamp,
    events,
  };
}

export type Step =
  | { you: string }
  | { interrupt: true }
  | { reject: string }
  | { says?: string; tools?: ToolUse[] };

export const bash = (command: string): ToolUse => ({ name: 'Bash', input: { command } });
export const edit = (file_path: string): ToolUse => ({ name: 'Edit', input: { file_path } });
