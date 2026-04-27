import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  cwd: text('cwd').notNull(),
  project_name: text('project_name').notNull(),
  git_branch: text('git_branch'),
  ai_title: text('ai_title'),
  first_user_message: text('first_user_message'),
  started_at: text('started_at').notNull(),
  ended_at: text('ended_at').notNull(),
  message_count: integer('message_count').notNull().default(0),
  turn_count: integer('turn_count').notNull().default(0),
  tool_call_count: integer('tool_call_count').notNull().default(0),
  ended_without_assistant_reply: integer('ended_without_assistant_reply', { mode: 'boolean' })
    .notNull()
    .default(false),
  assistant_question_count: integer('assistant_question_count').notNull().default(0),
  first_response_was_tool: integer('first_response_was_tool', { mode: 'boolean' })
    .notNull()
    .default(false),
  retry_signal_count: integer('retry_signal_count').notNull().default(0),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  session_id: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  content_text: text('content_text').notNull(),
  cwd: text('cwd'),
  git_branch: text('git_branch'),
  timestamp: text('timestamp').notNull(),
  token_count_estimate: integer('token_count_estimate').notNull().default(0),
  word_count: integer('word_count').notNull().default(0),
  has_file_path: integer('has_file_path', { mode: 'boolean' }).notNull().default(false),
  has_code_block: integer('has_code_block', { mode: 'boolean' }).notNull().default(false),
  has_error_message: integer('has_error_message', { mode: 'boolean' }).notNull().default(false),
  is_interrogative: integer('is_interrogative', { mode: 'boolean' }).notNull().default(false),
  retry_signal: integer('retry_signal', { mode: 'boolean' }).notNull().default(false),
});

export const toolCalls = sqliteTable('tool_calls', {
  id: text('id').primaryKey(),
  session_id: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  message_id: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  tool_name: text('tool_name').notNull(),
  arguments_json: text('arguments_json').notNull(),
  result_summary: text('result_summary'),
  timestamp: text('timestamp').notNull(),
});

export const summaries = sqliteTable('summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  period: text('period', { enum: ['daily', 'weekly', 'per-project'] }).notNull(),
  date: text('date').notNull(),
  project_path: text('project_path'),
  content_md: text('content_md').notNull(),
  model_used: text('model_used').notNull(),
  generated_at: text('generated_at').notNull(),
});

export const fileOffsets = sqliteTable('file_offsets', {
  session_file_path: text('session_file_path').primaryKey(),
  last_byte_read: integer('last_byte_read').notNull().default(0),
  last_processed_at: text('last_processed_at').notNull(),
});
