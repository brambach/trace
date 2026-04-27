import chokidar from 'chokidar';
import { CLAUDE_PROJECTS_DIR } from '@trace/shared';
import type { TraceDb } from '@trace/db';
import { processFile } from './process-file.js';

export function startWatcher(db: TraceDb, dir: string = CLAUDE_PROJECTS_DIR) {
  // chokidar v4 dropped glob support, so watch the directory and filter
  // non-jsonl files via the ignored callback.
  const watcher = chokidar.watch(dir, {
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    ignoreInitial: false,
    ignored: (filePath, stats) => {
      if (stats?.isFile() && !filePath.endsWith('.jsonl')) return true;
      return false;
    },
  });

  const handle = (path: string) => {
    if (!path.endsWith('.jsonl')) return;
    try {
      processFile(db, path);
    } catch (err) {
      console.error(`[watcher] processFile failed on ${path}:`, err);
    }
  };

  watcher.on('add', handle);
  watcher.on('change', handle);
  watcher.on('error', (err) => {
    console.error('[watcher] error', err);
  });
  watcher.on('ready', () => {
    console.log('[watcher] initial scan complete');
  });

  return watcher;
}
