export const coach = `
-- 0001_coach.sql
-- What each message is (prompt, tool result, interrupt...), which agent wrote
-- the session, and the fixes you applied or dismissed.

ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'prompt';
ALTER TABLE sessions ADD COLUMN agent TEXT NOT NULL DEFAULT 'claude';

UPDATE messages SET kind = CASE
  WHEN role = 'assistant' THEN 'reply'
  WHEN instr(content, 'want to proceed with this tool use') > 0 THEN 'rejection'
  WHEN trim(replace(replace(content_text, '[tool result]', ''), char(10), '')) = '' AND content_text <> '' THEN 'tool_result'
  WHEN content_text LIKE '[Request interrupted by user%' THEN 'interrupt'
  WHEN content_text LIKE '<command-%' OR content_text LIKE '<local-command%'
    OR content_text LIKE '<system-reminder>%' OR content_text LIKE 'Caveat: The messages below%'
    OR trim(content_text) = '' THEN 'meta'
  ELSE 'prompt'
END;

CREATE INDEX IF NOT EXISTS idx_messages_kind ON messages (kind);

CREATE TABLE IF NOT EXISTS fixes (
  id TEXT PRIMARY KEY,
  rule_key TEXT NOT NULL,
  target_path TEXT NOT NULL,
  line TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied','dismissed')),
  how TEXT CHECK (how IN ('local','pr')),
  pr_url TEXT,
  decided_at TEXT NOT NULL
);
`;
