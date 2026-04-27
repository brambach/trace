import { homedir } from 'node:os';
import { join } from 'node:path';

export const HOME = homedir();
export const CLAUDE_PROJECTS_DIR = join(HOME, '.claude', 'projects');
export const TRACE_HOME = join(HOME, 'Trace');
export const TRACE_DB_PATH = join(TRACE_HOME, 'trace.db');
export const TRACE_SUMMARIES_DIR = join(TRACE_HOME, 'summaries');
