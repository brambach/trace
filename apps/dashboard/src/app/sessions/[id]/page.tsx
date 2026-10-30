import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { loadTimelines } from '@trace/db';
import { coach } from '@trace/coach';
import { db } from '@/lib/db';
import { getCoach } from '@/lib/coach';
import { Masthead } from '@/components/Masthead';
import { Replay, type ReplayItem } from '@/components/Replay';
import { agentName } from '@/components/AgentMark';
import { compressedScale } from '@/lib/marks';
import { formatDate, formatTime, minutesBetween, plural } from '@/lib/format';
import { toolSummary } from '@/lib/tools';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ at?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = loadTimelines(db(), { sessionIds: [decodeURIComponent(id)] })[0];
  return { title: s?.ai_title ?? 'Session' };
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { at } = await searchParams;
  const session = loadTimelines(db(), { sessionIds: [decodeURIComponent(id)] })[0];
  if (!session) notFound();

  // Corrections come from the full coach run, so a correction that's part of
  // a habit links to its fix. Older sessions fall back to this one alone.
  const full = getCoach();
  const inWindow = full.timelines.some((t) => t.id === session.id);
  const result = inWindow ? full : coach([session]);
  const fixes = new Map(full.views.map((v) => [v.fix.id, v]));
  const corrections = new Map(result.corrections.filter((c) => c.sessionId === session.id).map((c) => [c.messageId, c]));

  const times = session.events.flatMap((e) => (e.kind === 'reply' ? e.tools.map((_, i) => Date.parse(e.timestamp) + i) : [Date.parse(e.timestamp)]));
  const x = compressedScale(times);

  const items: ReplayItem[] = [];
  for (const ev of session.events) {
    const t = Date.parse(ev.timestamp);
    const prev = items.at(-1);
    if (ev.kind === 'reply') {
      const tools = ev.tools.map((tool, i) => ({ name: tool.name, summary: toolSummary(tool), pos: x(t + i) }));
      if (prev?.kind === 'agent') {
        if (ev.text && !ev.text.startsWith('[tool:')) prev.text = prev.text ? `${prev.text}\n\n${ev.text}` : ev.text;
        prev.tools.push(...tools);
        continue;
      }
      items.push({ id: ev.id, kind: 'agent', pos: x(t), time: formatTime(ev.timestamp), text: ev.text.startsWith('[tool:') ? '' : ev.text, tools });
      continue;
    }
    if (ev.kind === 'interrupt') {
      items.push({ id: ev.id, kind: 'interrupt', pos: x(t), time: formatTime(ev.timestamp), text: '', tools: [] });
      continue;
    }
    if (ev.kind === 'rejection' && ev.text === '') {
      items.push({ id: ev.id, kind: 'rejected', pos: x(t), time: formatTime(ev.timestamp), text: '', tools: [] });
      continue;
    }
    const c = corrections.get(ev.id);
    const fixId = result.fixByMessage.get(ev.id);
    const view = fixId ? fixes.get(fixId) : undefined;
    items.push({
      id: ev.id,
      kind: c ? 'correction' : 'prompt',
      pos: x(t),
      time: formatTime(ev.timestamp),
      text: ev.text,
      tools: [],
      via: c?.via,
      fix: view ? { id: view.fix.id, line: view.fix.line, times: view.fix.times, state: view.state } : undefined,
    });
  }

  const prompts = items.filter((i) => i.kind === 'prompt' || i.kind === 'correction').length;
  const corrected = items.filter((i) => i.kind === 'correction').length;
  const toolCount = items.reduce((n, i) => n + i.tools.length, 0);

  return (
    <>
      <Masthead
        eyebrow={`${session.project_name} · ${formatDate(session.started_at)} · ${agentName(session.agent)}`}
        headline={session.ai_title ?? 'Untitled session'}
        deck={`${plural(prompts, 'prompt')} and ${plural(toolCount, 'tool call')} over ${plural(minutesBetween(session.started_at, session.ended_at), 'minute')}${
          corrected > 0 ? `. You corrected it ${corrected === 1 ? 'once' : `${corrected} times`}.` : '. It landed without a correction.'
        }`}
      />
      <Replay items={items} agent={session.agent} startAt={at ?? null} />
    </>
  );
}
