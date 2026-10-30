import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { contentTokens } from './words.js';
import type { Fix } from './types.js';

export const SECTION_HEADING = '## Notes from Trace';

export interface PlannedEdit {
  path: string;
  exists: boolean;
  before: string;
  after: string;
  // The lines this edit adds, for a diff preview.
  added: string[];
}

// True when the file already says this, so Trace shouldn't draft it again.
export function isCovered(fix: Pick<Fix, 'kind' | 'needles'>, content: string): boolean {
  const lower = content.toLowerCase();
  if (fix.kind !== 'your-words') return fix.needles.every((n) => lower.includes(n.toLowerCase()));
  return lower.split('\n').some((line) => {
    const tokens = new Set(contentTokens(line));
    const hit = fix.needles.filter((n) => tokens.has(n)).length;
    return fix.needles.length > 0 && hit / fix.needles.length >= 0.7;
  });
}

export function readIfExists(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

export function planEdit(path: string, line: string, current: string | null): PlannedEdit {
  const before = current ?? '';
  const bullet = `- ${line}`;
  let after: string;
  let added: string[];

  if (before.includes(SECTION_HEADING)) {
    // Append to the end of the existing Trace section.
    const lines = before.split('\n');
    const start = lines.findIndex((l) => l.trim() === SECTION_HEADING);
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{1,2}\s/u.test(lines[i]!)) {
        end = i;
        break;
      }
    }
    while (end > start + 1 && lines[end - 1]!.trim() === '') end--;
    lines.splice(end, 0, bullet);
    after = lines.join('\n');
    added = [bullet];
  } else {
    const sep = before === '' ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    added = [SECTION_HEADING, '', bullet];
    after = `${before}${sep}${added.join('\n')}\n`;
  }
  return { path, exists: current !== null, before, after, added };
}

export function applyEdit(edit: PlannedEdit): void {
  const now = readIfExists(edit.path) ?? '';
  if (now !== edit.before) {
    throw new StaleFileError(edit.path);
  }
  mkdirSync(dirname(edit.path), { recursive: true });
  writeFileSync(edit.path, edit.after);
}

export class StaleFileError extends Error {
  constructor(path: string) {
    super(`${path} changed since Trace read it. Reload and try again.`);
    this.name = 'StaleFileError';
  }
}
