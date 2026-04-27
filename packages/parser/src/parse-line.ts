import { AnyLineSchema } from '@trace/shared';
import type { ParsedEvent } from '@trace/shared';
import { extractText } from './extract-text.js';
import { extractToolCalls } from './extract-tool-calls.js';
import { computeFeatures } from './features.js';

export function parseLine(json: string): ParsedEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }

  const result = AnyLineSchema.safeParse(raw);
  if (!result.success) return null;
  const line = result.data;

  switch (line.type) {
    case 'user':
    case 'assistant': {
      const role = line.message.role;
      const contentText = extractText(line.message.content);
      const tokenCountEstimate = Math.ceil(contentText.length / 4);
      return {
        kind: 'message',
        sessionId: line.sessionId,
        uuid: line.uuid,
        role,
        timestamp: line.timestamp,
        cwd: line.cwd,
        gitBranch: line.gitBranch,
        contentRaw: line.message.content,
        contentText,
        tokenCountEstimate,
        features: computeFeatures(contentText, role),
        toolCalls: role === 'assistant' ? extractToolCalls(line.message.content) : [],
      };
    }
    case 'ai-title':
      return { kind: 'ai-title', sessionId: line.sessionId, aiTitle: line.aiTitle };
    default:
      return { kind: 'noise' };
  }
}
