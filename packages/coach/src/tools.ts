import type { ToolUse } from './types.js';

export function commandOf(tool: ToolUse): string | null {
  if (tool.name !== 'Bash') return null;
  const c = tool.input.command;
  return typeof c === 'string' ? c : null;
}
