type Block = { type: string; text?: string; name?: string; [key: string]: unknown };

export function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object' || !('type' in block)) continue;
    const b = block as Block;

    switch (b.type) {
      case 'text':
        if (typeof b.text === 'string') parts.push(b.text);
        break;
      case 'tool_use':
        parts.push(`[tool: ${typeof b.name === 'string' ? b.name : 'unknown'}]`);
        break;
      case 'tool_result':
        parts.push('[tool result]');
        break;
      default:
        break;
    }
  }
  return parts.join('\n\n');
}
