import chokidar from 'chokidar';
import { CLAUDE_PROJECTS_DIR } from '@trace/shared';
import type { TraceDb } from '@trace/db';
import { processFile } from './process-file.js';

export function startWatcher(db: TraceDb, dir: string = CLAUDE_PROJECTS_DIR) {
  const watcher = chokidar.watch(`${dir}/**/*.jsonl`, {
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    ignoreInitial: false,
  });

  watcher.on('add', (path) => processFile(db, path));
  watcher.on('change', (path) => processFile(db, path));
  watcher.on('error', (err) => {
    console.error('[watcher] error', err);
  });

  return watcher;
}
