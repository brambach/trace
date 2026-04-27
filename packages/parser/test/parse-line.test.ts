import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLine } from '../src/parse-line.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf8');

describe('parseLine', () => {
  it('parses a user line', () => {
    const event = parseLine(fixture('user-line.json'));
    expect(event).not.toBeNull();
    if (!event || event.kind !== 'message') throw new Error('expected message');
    expect(event.role).toBe('user');
    expect(event.sessionId).toBe('00000000-0000-0000-0000-000000000001');
    expect(event.contentText).toContain('null timestamps');
    expect(event.toolCalls).toHaveLength(0);
  });

  it('parses an assistant line', () => {
    const event = parseLine(fixture('assistant-line.json'));
    if (!event || event.kind !== 'message') throw new Error('expected message');
    expect(event.role).toBe('assistant');
    expect(event.contentText).toBe('Got it. Let me read the file.');
  });

  it('returns null for invalid JSON', () => {
    expect(parseLine('not json')).toBeNull();
  });
});

describe('parseLine — non-message line types', () => {
  it('extracts ai-title', () => {
    const event = parseLine(fixture('ai-title.json'));
    if (!event || event.kind !== 'ai-title') throw new Error('expected ai-title');
    expect(event.aiTitle).toBe('Fix null timestamp parsing');
    expect(event.sessionId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('classifies attachment as noise (v1)', () => {
    const event = parseLine(fixture('attachment.json'));
    if (!event) throw new Error('expected event');
    expect(event.kind).toBe('noise');
  });

  it('classifies queue-operation as noise', () => {
    const event = parseLine(fixture('queue-operation.json'));
    if (!event) throw new Error('expected event');
    expect(event.kind).toBe('noise');
  });

  it('returns null for an unknown line shape', () => {
    expect(parseLine(JSON.stringify({ totally: 'unknown' }))).toBeNull();
  });
});
