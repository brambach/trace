import type { ParsedToolCall } from '@trace/shared';

export function extractToolCalls(content: unknown): ParsedToolCall[] {
  if (!Array.isArray(content)) return [];
  const calls: ParsedToolCall[] = [];
  for (const block of content) {
    if (block && typeof block === 'object' && 'type' in block) {
      const b = block as { type: string; id?: string; name?: string; input?: unknown };
      if (b.type === 'tool_use' && b.id && b.name) {
        calls.push({ id: b.id, name: b.name, arguments_json: JSON.stringify(b.input ?? {}) });
      }
    }
  }
  return calls;
}
