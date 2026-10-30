import type { SessionTimeline } from '@trace/shared';

export interface StripMark {
  t: number;
  kind: 'prompt' | 'correction' | 'tool';
  // 0 to 1. For prompts, how long the prompt was.
  size: number;
  id: string;
}

// A prompt of 1 word is a nub; 120 words or more fills the height.
function sizeOf(words: number): number {
  return Math.min(1, Math.log1p(words) / Math.log1p(120));
}

export function marksFor(session: SessionTimeline, corrections: Set<string>): StripMark[] {
  const marks: StripMark[] = [];
  for (const ev of session.events) {
    const t = Date.parse(ev.timestamp);
    if (ev.kind === 'prompt' || (ev.kind === 'rejection' && ev.text !== '')) {
      const words = ev.text.trim().split(/\s+/u).length;
      marks.push({ t, kind: corrections.has(ev.id) ? 'correction' : 'prompt', size: sizeOf(words), id: ev.id });
    } else if (ev.kind === 'reply') {
      ev.tools.forEach((_, i) => marks.push({ t: t + i, kind: 'tool', size: 0, id: `${ev.id}:${i}` }));
    }
  }
  return marks;
}

// Maps real time onto 0..1 with long idle gaps squeezed to `cap` ms, so a
// session you walked away from for an hour still reads as one piece.
export function compressedScale(times: number[], cap = 4 * 60_000): (t: number) => number {
  const sorted = [...new Set(times)].sort((a, b) => a - b);
  if (sorted.length < 2) return () => 0.5;
  const pos = new Map<number, number>();
  let acc = 0;
  pos.set(sorted[0]!, 0);
  for (let i = 1; i < sorted.length; i++) {
    acc += Math.min(cap, sorted[i]! - sorted[i - 1]!);
    pos.set(sorted[i]!, acc);
  }
  const total = acc || 1;
  return (t: number) => {
    const exact = pos.get(t);
    if (exact !== undefined) return exact / total;
    // Between known points, interpolate on the compressed axis.
    let lo = 0;
    let hi = sorted.length - 1;
    if (t <= sorted[0]!) return 0;
    if (t >= sorted[hi]!) return 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid]! <= t) lo = mid;
      else hi = mid;
    }
    const a = sorted[lo]!;
    const b = sorted[hi]!;
    const pa = pos.get(a)!;
    const pb = pos.get(b)!;
    return (pa + ((t - a) / (b - a)) * (pb - pa)) / total;
  };
}

export function linearScale(t0: number, t1: number): (t: number) => number {
  const span = Math.max(1, t1 - t0);
  return (t: number) => Math.min(1, Math.max(0, (t - t0) / span));
}
