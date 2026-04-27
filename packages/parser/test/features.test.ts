import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../src/features.js';

const f = (text: string) => computeFeatures(text, 'user');

describe('computeFeatures (user)', () => {
  it('counts words', () => {
    expect(f('  fix   the  thing  ').word_count).toBe(3);
    expect(f('').word_count).toBe(0);
  });

  it('detects a file path', () => {
    expect(f('Update src/parser.ts please').has_file_path).toBe(true);
    expect(f('refactor /Users/me/projects/trace/src/index.ts').has_file_path).toBe(true);
  });

  it('does not flag bare words as file paths', () => {
    expect(f('refactor the parser').has_file_path).toBe(false);
  });

  it('detects code blocks', () => {
    expect(f('here:\n```\ncode\n```').has_code_block).toBe(true);
    expect(f('inline `code` only').has_code_block).toBe(false);
  });

  it('detects error messages', () => {
    expect(f('I am seeing TypeError: cannot read').has_error_message).toBe(true);
    expect(f('the test failed with an Error: bad thing').has_error_message).toBe(true);
    expect(f('please refactor').has_error_message).toBe(false);
  });

  it('marks questions, but not imperatives ending in ?', () => {
    expect(f('what should we do here?').is_interrogative).toBe(true);
    expect(f('fix the bug?').is_interrogative).toBe(false);
    expect(f('refactor this please').is_interrogative).toBe(false);
  });

  it('flags retry signals', () => {
    expect(f("no, not that — try the other one").retry_signal).toBe(true);
    expect(f('Actually, do it the other way').retry_signal).toBe(true);
    expect(f("that's wrong, undo it").retry_signal).toBe(true);
    expect(f('looks good, ship it').retry_signal).toBe(false);
  });
});

describe('computeFeatures (assistant)', () => {
  it('does not flag retry or interrogative for assistant messages', () => {
    const a = computeFeatures("That's wrong, undo it.", 'assistant');
    expect(a.retry_signal).toBe(false);
    expect(a.is_interrogative).toBe(false);
  });

  it('still counts words and code blocks for assistant', () => {
    const a = computeFeatures('Here is the code:\n```ts\nconst x = 1;\n```', 'assistant');
    expect(a.word_count).toBeGreaterThan(0);
    expect(a.has_code_block).toBe(true);
  });
});
