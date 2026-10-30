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

export type Agent = 'claude' | 'codex';

// What a message is, beyond its role. A Claude Code "user" line can be a
// prompt you typed, a tool result, an interrupt or a rejected tool call.
export type MessageKind = 'prompt' | 'reply' | 'tool_result' | 'interrupt' | 'rejection' | 'meta';

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
      messageKind: MessageKind;
      agent: Agent;
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
  | {
      kind: 'session-meta';
      sessionId: string;
      agent: Agent;
      timestamp: string;
      cwd: string;
      gitBranch: string | null;
    }
  | { kind: 'noise' };

// A session as an ordered list of what happened, for replay and the coach.
export interface ToolUse {
  name: string;
  input: Record<string, unknown>;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  role: Role;
  kind: MessageKind;
  text: string;
  tools: ToolUse[];
}

export interface SessionTimeline {
  id: string;
  cwd: string;
  project_name: string;
  agent: Agent;
  ai_title: string | null;
  started_at: string;
  ended_at: string;
  events: TimelineEvent[];
}
