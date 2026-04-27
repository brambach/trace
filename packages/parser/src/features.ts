import type { PromptFeatures } from '@trace/shared';

export function computeFeatures(text: string, role: 'user' | 'assistant'): PromptFeatures {
  return {
    word_count: text.trim() === '' ? 0 : text.trim().split(/\s+/u).length,
    has_file_path: false,
    has_code_block: false,
    has_error_message: false,
    is_interrogative: false,
    retry_signal: false,
  };
  void role;
}
