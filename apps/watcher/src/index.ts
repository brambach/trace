import { getDb, closeDb } from '@trace/db';
import { CLAUDE_PROJECTS_DIR, CODEX_SESSIONS_DIR, TRACE_DB_PATH } from '@trace/shared';
import { startWatcher } from './watch.js';

const db = getDb(TRACE_DB_PATH);
const watcher = startWatcher(db);

console.log(`[watcher] watching ${CLAUDE_PROJECTS_DIR} and ${CODEX_SESSIONS_DIR}`);
console.log(`[watcher] writing to ${TRACE_DB_PATH}`);

const shutdown = async () => {
  console.log('[watcher] shutting down');
  await watcher.close();
  closeDb(db);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
