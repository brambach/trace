import type { MessageKind } from '@trace/shared';

const META_OPENERS = [
  '<command-name>',
  '<command-message>',
  '<local-command-stdout>',
  '<local-command-stderr>',
  '<system-reminder>',
  '<environment_context>',
  '<user_instructions>',
  'Caveat: The messages below',
];

const REJECTED_RE = /doesn'?t want to (?:proceed|take this action)|tool use was rejected/iu;
// When you reject a tool call and type why, Claude Code puts your words in the
// tool result after one of these lead-ins.
const REJECTION_REASON_RE =
  /(?:the user said|reason for the rejection|user provided the following reason)[^:\n]*:\s*([\s\S]+)$/iu;

type Block = { type?: unknown; text?: unknown; content?: unknown };

export interface Classified {
  kind: MessageKind;
  // Replaces the extracted text when the useful words sit somewhere else,
  // like a rejection reason inside a tool result.
  text?: string;
}

export function classifyUserContent(content: unknown, text: string, isMeta: boolean): Classified {
  if (isMeta) return { kind: 'meta' };
  const trimmed = text.trim();
  if (META_OPENERS.some((m) => trimmed.startsWith(m))) return { kind: 'meta' };
  if (/^\[Request interrupted by user/u.test(trimmed)) return { kind: 'interrupt' };

  if (Array.isArray(content)) {
    const blocks = content as Block[];
    const results = blocks.filter((b) => b?.type === 'tool_result');
    const typed = blocks.some((b) => b?.type === 'text' && typeof b.text === 'string' && b.text.trim() !== '');
    if (results.length > 0 && !typed) {
      for (const r of results) {
        const body = toolResultText(r.content);
        if (REJECTED_RE.test(body)) {
          const reason = REJECTION_REASON_RE.exec(body)?.[1]?.trim();
          return reason ? { kind: 'rejection', text: reason } : { kind: 'rejection', text: '' };
        }
      }
      return { kind: 'tool_result' };
    }
  }
  if (trimmed === '') return { kind: 'meta' };
  return { kind: 'prompt' };
}

function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((c: Block) => (c && typeof c.text === 'string' ? c.text : ''))
    .join('\n');
}
