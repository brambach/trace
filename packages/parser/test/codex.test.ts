import { describe, expect, it } from 'vitest';
import { parseCodexLine, codexSessionIdFromPath } from '../src/parse-codex-line.js';

const ctx = { sessionId: 'codex-1', lineId: 'codex-1:0' };
const line = (type: string, payload: unknown) =>
  JSON.stringify({ timestamp: '2026-10-26T10:00:00.000Z', type, payload });

describe('parseCodexLine', () => {
  it('reads the session id from the rollout file name', () => {
    expect(
      codexSessionIdFromPath('/h/.codex/sessions/2026/10/26/rollout-2026-10-26T10-00-00-0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b.jsonl'),
    ).toBe('codex-0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');
    expect(codexSessionIdFromPath('/h/.claude/projects/x/abc.jsonl')).toBeNull();
  });

  it('turns session_meta into the session cwd and branch', () => {
    const ev = parseCodexLine(line('session_meta', { id: 'x', cwd: '/Users/me/code/acme', git: { branch: 'main' } }), ctx);
    expect(ev).toMatchObject({ kind: 'session-meta', cwd: '/Users/me/code/acme', gitBranch: 'main', agent: 'codex' });
  });

  it('reads prompts and replies, and skips the environment block', () => {
    const prompt = parseCodexLine(line('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'fix the build' }] }), ctx);
    expect(prompt).toMatchObject({ kind: 'message', role: 'user', messageKind: 'prompt', contentText: 'fix the build' });
    const env = parseCodexLine(
      line('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>\n<cwd>/x</cwd>' }] }),
      ctx,
    );
    expect(env).toMatchObject({ messageKind: 'meta' });
  });

  it('maps shell and apply_patch onto Bash and Edit', () => {
    const shell = parseCodexLine(
      line('response_item', { type: 'function_call', name: 'shell', call_id: 'c1', arguments: JSON.stringify({ command: ['bash', '-lc', 'npm test'] }) }),
      ctx,
    );
    expect(shell?.kind === 'message' && shell.toolCalls[0]).toEqual({ id: 'c1', name: 'Bash', arguments_json: '{"command":"npm test"}' });
    const patch = parseCodexLine(
      line('response_item', { type: 'custom_tool_call', name: 'apply_patch', call_id: 'c2', input: '*** Begin Patch\n*** Update File: src/a.ts\n@@' }),
      ctx,
    );
    expect(patch?.kind === 'message' && patch.toolCalls[0]).toEqual({ id: 'c2', name: 'Edit', arguments_json: '{"file_path":"src/a.ts"}' });
  });
});
