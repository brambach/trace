// A tiny script language for made-up sessions. Each step advances a clock, so
// a session replays at a believable pace.

export interface Tool {
  name: string;
  input: Record<string, unknown>;
  // What the tool returned. Kept short; replay only shows that it ran.
  result?: string;
}

export type Step =
  | { t: 'you'; text: string; wait: number }
  | { t: 'agent'; text: string; tools: Tool[]; wait: number }
  | { t: 'interrupt'; wait: number }
  | { t: 'reject'; reason: string; wait: number };

export interface Script {
  id: string;
  project: string;
  agent?: 'claude' | 'codex';
  day: number;
  // Hour of day (UTC). Ignored for today's sessions, which end shortly before now.
  at: number;
  title: string;
  steps: Step[];
}

export const you = (text: string, wait = 40): Step => ({ t: 'you', text, wait });
export const agent = (text: string, tools: Tool[] = [], wait = 25): Step => ({ t: 'agent', text, tools, wait });
export const interrupt = (wait = 6): Step => ({ t: 'interrupt', wait });
export const reject = (reason: string, wait = 8): Step => ({ t: 'reject', reason, wait });

export const bash = (command: string, result = ''): Tool => ({ name: 'Bash', input: { command }, result });
export const read = (file_path: string): Tool => ({ name: 'Read', input: { file_path } });
export const edit = (file_path: string): Tool => ({ name: 'Edit', input: { file_path } });
export const write = (file_path: string): Tool => ({ name: 'Write', input: { file_path } });
export const grep = (pattern: string): Tool => ({ name: 'Grep', input: { pattern } });
