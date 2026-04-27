import { z } from 'zod';

const ContentBlock = z.union([
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.unknown().optional(),
    is_error: z.boolean().optional(),
  }),
  z.object({ type: z.string() }).passthrough(),
]);

const Message = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.union([z.string(), z.array(ContentBlock)]),
  })
  .passthrough();

export const UserLineSchema = z
  .object({
    type: z.literal('user'),
    sessionId: z.string(),
    timestamp: z.string(),
    uuid: z.string(),
    parentUuid: z.string().nullable().optional(),
    cwd: z.string().optional(),
    gitBranch: z.string().nullable().optional(),
    message: Message,
  })
  .passthrough();

export const AssistantLineSchema = z
  .object({
    type: z.literal('assistant'),
    sessionId: z.string(),
    timestamp: z.string(),
    uuid: z.string(),
    parentUuid: z.string().nullable().optional(),
    cwd: z.string().optional(),
    gitBranch: z.string().nullable().optional(),
    message: Message,
  })
  .passthrough();

export const AiTitleLineSchema = z
  .object({
    type: z.literal('ai-title'),
    sessionId: z.string(),
    aiTitle: z.string(),
  })
  .passthrough();

export const AttachmentLineSchema = z
  .object({
    type: z.literal('attachment'),
    sessionId: z.string(),
    timestamp: z.string().optional(),
  })
  .passthrough();

export const NoiseLineSchema = z
  .object({
    type: z.enum(['queue-operation', 'file-history-snapshot', 'last-prompt']),
  })
  .passthrough();

export const AnyLineSchema = z.union([
  UserLineSchema,
  AssistantLineSchema,
  AiTitleLineSchema,
  AttachmentLineSchema,
  NoiseLineSchema,
]);
