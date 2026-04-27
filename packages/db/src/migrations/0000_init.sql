-- 0000_init.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  cwd TEXT NOT NULL,
  project_name TEXT NOT NULL,
  git_branch TEXT,
  ai_title TEXT,
  first_user_message TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  turn_count INTEGER NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  ended_without_assistant_reply INTEGER NOT NULL DEFAULT 0,
  assistant_question_count INTEGER NOT NULL DEFAULT 0,
  first_response_was_tool INTEGER NOT NULL DEFAULT 0,
  retry_signal_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions (project_name);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  content_text TEXT NOT NULL,
  cwd TEXT,
  git_branch TEXT,
  timestamp TEXT NOT NULL,
  token_count_estimate INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  has_file_path INTEGER NOT NULL DEFAULT 0,
  has_code_block INTEGER NOT NULL DEFAULT 0,
  has_error_message INTEGER NOT NULL DEFAULT 0,
  is_interrogative INTEGER NOT NULL DEFAULT 0,
  retry_signal INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages (role);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  arguments_json TEXT NOT NULL,
  result_summary TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls (session_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_name ON tool_calls (tool_name);

CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL CHECK (period IN ('daily','weekly','per-project')),
  date TEXT NOT NULL,
  project_path TEXT,
  content_md TEXT NOT NULL,
  model_used TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_offsets (
  session_file_path TEXT PRIMARY KEY,
  last_byte_read INTEGER NOT NULL DEFAULT 0,
  last_processed_at TEXT NOT NULL
);

-- Full-text search over messages.content_text. Contentless FTS5 with manual sync.
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5 (
  content_text,
  session_id UNINDEXED,
  message_id UNINDEXED,
  timestamp UNINDEXED,
  tokenize = 'porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages
BEGIN
  INSERT INTO messages_fts (rowid, content_text, session_id, message_id, timestamp)
  VALUES (new.rowid, new.content_text, new.session_id, new.id, new.timestamp);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages
BEGIN
  INSERT INTO messages_fts (messages_fts, rowid, content_text, session_id, message_id, timestamp)
  VALUES ('delete', old.rowid, old.content_text, old.session_id, old.id, old.timestamp);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages
BEGIN
  INSERT INTO messages_fts (messages_fts, rowid, content_text, session_id, message_id, timestamp)
  VALUES ('delete', old.rowid, old.content_text, old.session_id, old.id, old.timestamp);
  INSERT INTO messages_fts (rowid, content_text, session_id, message_id, timestamp)
  VALUES (new.rowid, new.content_text, new.session_id, new.id, new.timestamp);
END;
