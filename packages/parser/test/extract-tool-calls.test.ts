import { describe, expect, it } from 'vitest';
import { extractToolCalls } from '../src/extract-tool-calls.js';

describe('extractToolCalls', () => {
  it('returns empty for string content', () => {
    expect(extractToolCalls('text only')).toEqual([]);
  });

  it('returns empty when no tool_use blocks', () => {
    expect(extractToolCalls([{ type: 'text', text: 'hi' }])).toEqual([]);
  });

  it('extracts a single tool_use', () => {
    const calls = extractToolCalls([
      { type: 'text', text: 'reading' },
      { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: '/a.ts' } },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.id).toBe('toolu_1');
    expect(calls[0]?.name).toBe('Read');
    expect(JSON.parse(calls[0]?.arguments_json ?? '{}')).toEqual({ file_path: '/a.ts' });
  });

  it('preserves order across multiple tool_use blocks', () => {
    const calls = extractToolCalls([
      { type: 'tool_use', id: 'a', name: 'Bash', input: { command: 'ls' } },
      { type: 'text', text: 'and now' },
      { type: 'tool_use', id: 'b', name: 'Edit', input: { path: '/x' } },
    ]);
    expect(calls.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
