import type { ToolUse } from '@trace/shared';

export function toolSummary(t: ToolUse): string {
  const i = t.input;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const short = (p: string) => {
    const parts = p.split('/');
    return parts.length > 4 ? `…/${parts.slice(-3).join('/')}` : p;
  };
  switch (t.name) {
    case 'Bash':
      return str(i.command);
    case 'Read':
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return short(str(i.file_path) || str(i.notebook_path));
    case 'Grep':
    case 'Glob':
      return str(i.pattern);
    case 'Task':
    case 'Agent':
      return str(i.description);
    case 'WebFetch':
      return str(i.url);
    case 'WebSearch':
      return str(i.query);
    case 'TodoWrite':
      return 'updated the plan';
    default:
      return '';
  }
}
