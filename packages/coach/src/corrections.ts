import { matchesRetry } from '@trace/parser';
import { switchedPackageManager } from './rules.js';
import type { Correction, SessionTimeline, ToolUse } from './types.js';

const CONTEXT_TOOLS = 6;

// A correction is a prompt that redirects the agent after it has done
// something: it follows an interrupt or a rejected tool call, or it reads like
// a redirect ("no, use pnpm", "I said...", "don't...").
export function findCorrections(session: SessionTimeline): Correction[] {
  const out: Correction[] = [];
  let seenPrompt = false;
  let since: ToolUse[] = [];
  let agentActed = false;
  let interrupted = false;

  for (const ev of session.events) {
    if (ev.kind === 'reply') {
      agentActed = true;
      since.push(...ev.tools);
      continue;
    }
    if (ev.kind === 'interrupt') {
      interrupted = true;
      continue;
    }
    if (ev.kind !== 'prompt' && ev.kind !== 'rejection') continue;

    const text = ev.text.trim();
    const via: Correction['via'] | null =
      ev.kind === 'rejection'
        ? 'rejection'
        : interrupted
          ? 'interrupt'
          : matchesRetry(text) || switchedPackageManager(text, since)
            ? 'said'
            : null;

    if (seenPrompt && agentActed && via && text !== '') {
      out.push({
        sessionId: session.id,
        messageId: ev.id,
        timestamp: ev.timestamp,
        cwd: session.cwd,
        project_name: session.project_name,
        text,
        via,
        before: since.slice(-CONTEXT_TOOLS),
      });
    }

    // A rejection with no reason is followed by the prompt that explains it,
    // so keep the context and the interrupt flag alive for that one.
    if (ev.kind === 'rejection' && text === '') {
      interrupted = true;
      continue;
    }
    seenPrompt = true;
    agentActed = false;
    interrupted = false;
    since = [];
  }
  return out;
}
