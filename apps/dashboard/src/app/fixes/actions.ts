'use server';

import { applyEdit, openPullRequest, planEdit } from '@trace/coach';
import { clearFixDecision, recordFixDecision } from '@trace/db';
import { db } from '@/lib/db';
import { getCoach, readClaudeMd } from '@/lib/coach';
import { isDemo } from '@/lib/mode';

// The page refreshes itself after the apply animation plays, so these don't
// revalidate.
export interface ActionResult {
  ok: boolean;
  message: string;
  url?: string;
}

function find(id: string) {
  return getCoach().views.find((v) => v.fix.id === id)?.fix ?? null;
}

function record(id: string, status: 'applied' | 'dismissed', how: 'local' | 'pr' | null, pr_url: string | null) {
  const fix = find(id);
  if (!fix) return;
  recordFixDecision(db(), {
    id,
    rule_key: fix.key,
    target_path: fix.target.path,
    line: fix.line,
    status,
    how,
    pr_url,
    decided_at: new Date().toISOString(),
  });
}

export async function applyFix(id: string): Promise<ActionResult> {
  const fix = find(id);
  if (!fix) return { ok: false, message: 'That fix is gone. Reload the page.' };
  if (isDemo) return { ok: true, message: 'In the demo nothing is written. On your machine, this line is now in the file.' };
  try {
    applyEdit(planEdit(fix.target.path, fix.line, readClaudeMd(fix.target.path)));
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not write the file.' };
  }
  record(id, 'applied', 'local', null);
  return { ok: true, message: 'Written. The agent reads it at the start of every session.' };
}

export async function openFixPr(id: string): Promise<ActionResult> {
  const fix = find(id);
  if (!fix) return { ok: false, message: 'That fix is gone. Reload the page.' };
  if (isDemo) return { ok: true, message: 'In the demo no PR is opened. On your machine, Trace pushes a branch and opens one with gh.' };
  try {
    const url = openPullRequest(fix);
    record(id, 'applied', 'pr', url);
      return { ok: true, message: 'PR opened.', url };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not open the PR.' };
  }
}

export async function dismissFix(id: string): Promise<ActionResult> {
  if (isDemo) return { ok: true, message: 'Dismissed for this visit.' };
  record(id, 'dismissed', null, null);
  return { ok: true, message: 'Dismissed. Trace won’t draft it again.' };
}

export async function restoreFix(id: string): Promise<ActionResult> {
  if (isDemo) return { ok: true, message: 'Restored.' };
  clearFixDecision(db(), id);
  return { ok: true, message: 'Back on the list.' };
}
