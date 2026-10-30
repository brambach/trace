import { describe, expect, it } from 'vitest';
import { parseLine } from '../src/parse-line.js';

const user = (content: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'user',
    sessionId: 's',
    timestamp: '2026-10-26T10:00:00.000Z',
    uuid: 'u',
    message: { role: 'user', content },
    ...extra,
  });

const kindOf = (line: string) => {
  const ev = parseLine(line);
  return ev?.kind === 'message' ? { kind: ev.messageKind, text: ev.contentText } : null;
};

describe('message kinds', () => {
  it('tells a typed prompt from a tool result', () => {
    expect(kindOf(user('fix the parser'))?.kind).toBe('prompt');
    expect(kindOf(user([{ type: 'tool_result', tool_use_id: 't', content: 'ok' }]))?.kind).toBe('tool_result');
  });

  it('marks interrupts and slash command noise', () => {
    expect(kindOf(user([{ type: 'text', text: '[Request interrupted by user]' }]))?.kind).toBe('interrupt');
    expect(kindOf(user('<command-name>/clear</command-name>'))?.kind).toBe('meta');
    expect(kindOf(user('anything', { isMeta: true }))?.kind).toBe('meta');
  });

  it('pulls your reason out of a rejected tool call', () => {
    const rejected = user([
      {
        type: 'tool_result',
        tool_use_id: 't',
        is_error: true,
        content:
          "The user doesn't want to proceed with this tool use. The tool use was rejected. The user provided the following reason for the rejection: use pnpm, not npm",
      },
    ]);
    expect(kindOf(rejected)).toEqual({ kind: 'rejection', text: 'use pnpm, not npm' });
  });
});
