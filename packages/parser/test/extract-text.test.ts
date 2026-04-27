import { describe, expect, it } from 'vitest';
import { extractText } from '../src/extract-text.js';

describe('extractText', () => {
  it('returns string content as-is', () => {
    expect(extractText('hello world')).toBe('hello world');
  });

  it('joins text blocks with two newlines', () => {
    const result = extractText([
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ]);
    expect(result).toBe('first\n\nsecond');
  });

  it('summarizes tool_use blocks inline', () => {
    const result = extractText([
      { type: 'text', text: 'reading file' },
      { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a/b.ts' } },
    ]);
    expect(result).toContain('reading file');
    expect(result).toContain('[tool: Read]');
  });

  it('summarizes tool_result blocks inline', () => {
    const result = extractText([
      { type: 'tool_result', tool_use_id: 't1', content: 'file contents' },
    ]);
    expect(result).toContain('[tool result]');
  });

  it('returns empty string for unknown shapes', () => {
    expect(extractText(123)).toBe('');
    expect(extractText(null)).toBe('');
    expect(extractText(undefined)).toBe('');
  });
});
