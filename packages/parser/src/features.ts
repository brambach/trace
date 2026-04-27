import type { PromptFeatures } from '@trace/shared';
import { matchesRetry } from './retry-phrases.js';

const FILE_PATH_RE = /(?:^|[\s(`'"])(?:[a-zA-Z]:)?(?:\/|\.\/|[\w.-]+\/)[\w./-]+\.[a-zA-Z]{1,6}\b/u;
const CODE_BLOCK_RE = /```/u;
const ERROR_RE =
  /\b(?:Error|TypeError|ReferenceError|SyntaxError|RangeError|UnhandledPromiseRejection|Traceback|stack trace)\b/u;
const QUESTION_END_RE = /\?\s*$/u;
const IMPERATIVE_OPENERS_RE =
  /^\s*(?:add|fix|update|create|delete|remove|refactor|implement|write|change|move|rename|build|run|install|set|make|use|stop|start|generate|commit|push|merge|revert|investigate|review)\b/iu;

export function computeFeatures(text: string, role: 'user' | 'assistant'): PromptFeatures {
  const trimmed = text.trim();
  const word_count = trimmed === '' ? 0 : trimmed.split(/\s+/u).length;

  const features: PromptFeatures = {
    word_count,
    has_file_path: FILE_PATH_RE.test(text),
    has_code_block: CODE_BLOCK_RE.test(text),
    has_error_message: ERROR_RE.test(text),
    is_interrogative: false,
    retry_signal: false,
  };

  if (role !== 'user') return features;

  features.is_interrogative = QUESTION_END_RE.test(trimmed) && !IMPERATIVE_OPENERS_RE.test(trimmed);
  features.retry_signal = matchesRetry(trimmed);
  return features;
}
