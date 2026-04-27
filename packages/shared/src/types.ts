import { type z } from 'zod';
import type {
  UserLineSchema,
  AssistantLineSchema,
  AiTitleLineSchema,
  AttachmentLineSchema,
  NoiseLineSchema,
} from './schemas.js';

export type UserLine = z.infer<typeof UserLineSchema>;
export type AssistantLine = z.infer<typeof AssistantLineSchema>;
export type AiTitleLine = z.infer<typeof AiTitleLineSchema>;
export type AttachmentLine = z.infer<typeof AttachmentLineSchema>;
export type NoiseLine = z.infer<typeof NoiseLineSchema>;

export type Role = 'user' | 'assistant';

export interface PromptFeatures {
  word_count: number;
  has_file_path: boolean;
  has_code_block: boolean;
  has_error_message: boolean;
  is_interrogative: boolean;
  retry_signal: boolean;
}

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments_json: string;
}

export type ParsedEvent =
  | {
      kind: 'message';
      sessionId: string;
      uuid: string;
      role: Role;
      timestamp: string;
      cwd: string | undefined;
      gitBranch: string | null | undefined;
      contentRaw: unknown;
      contentText: string;
      tokenCountEstimate: number;
      features: PromptFeatures;
      toolCalls: ParsedToolCall[];
    }
  | { kind: 'ai-title'; sessionId: string; aiTitle: string }
  | { kind: 'noise' };
