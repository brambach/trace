import type { SessionTimeline, ToolUse } from '@trace/shared';

export type { SessionTimeline, TimelineEvent, ToolUse } from '@trace/shared';

export interface Correction {
  sessionId: string;
  messageId: string;
  timestamp: string;
  cwd: string;
  project_name: string;
  text: string;
  // How you corrected: typed it, stopped Claude first, or rejected a tool call.
  via: 'said' | 'interrupt' | 'rejection';
  // What the agent did right before, newest last.
  before: ToolUse[];
}

export type RuleKind = 'package-manager' | 'command' | 'your-words';

export interface Rule {
  kind: RuleKind;
  key: string;
  line: string;
  // Short, readable label for the habit, in the second person.
  habit: string;
  // What the agent did that drew the correction, when Trace can tell.
  did: string | null;
  // Words matched against an existing CLAUDE.md to see if it's already there.
  needles: string[];
}

export interface Evidence {
  sessionId: string;
  messageId: string;
  timestamp: string;
  project_name: string;
  quote: string;
  did: string | null;
  via: Correction['via'];
}

export interface FixTarget {
  scope: 'project' | 'global';
  cwd: string | null;
  path: string;
}

export interface Fix {
  id: string;
  kind: RuleKind;
  key: string;
  line: string;
  habit: string;
  // What you keep telling the agent, short enough to quote in a sentence.
  said: string;
  times: number;
  sessions: number;
  projects: string[];
  target: FixTarget;
  evidence: Evidence[];
  first_seen: string;
  last_seen: string;
  needles: string[];
}
