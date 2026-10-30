'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Strip } from './Strip';
import { AgentMark, agentName } from './AgentMark';
import { Inline } from './Inline';
import type { StripMark } from '@/lib/marks';

export interface ReplayItem {
  id: string;
  kind: 'prompt' | 'correction' | 'agent' | 'interrupt' | 'rejected';
  // Where it sits on the session's compressed timeline, 0 to 1.
  pos: number;
  time: string;
  text: string;
  tools: { name: string; summary: string; pos: number }[];
  via?: 'said' | 'interrupt' | 'rejection';
  fix?: { id: string; line: string; times: number; state: string };
}

const SPEEDS = [1, 3] as const;
const identity = (t: number) => t;

// Replay rebuilds the session at its real relative pace, sped up, with idle
// gaps squeezed. It starts finished, so the page reads like a transcript until
// you press play.
export function Replay({ items, agent, startAt }: { items: ReplayItem[]; agent: 'claude' | 'codex'; startAt: string | null }) {
  const startItem = startAt ? items.find((i) => i.id === startAt) : undefined;
  const [p, setP] = useState(startItem ? startItem.pos : 1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [focus, setFocus] = useState<string | null>(startItem?.id ?? null);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const prevVisible = useRef<number>(items.length);

  // About 40 seconds for a whole session at 1x, whatever its length.
  const duration = 40_000;

  const marks: StripMark[] = useMemo(
    () =>
      items.flatMap((i): StripMark[] => {
        if (i.kind === 'agent') return i.tools.map((t, k) => ({ t: t.pos, kind: 'tool', size: 0, id: `${i.id}:${k}` }));
        if (i.kind !== 'prompt' && i.kind !== 'correction') return [];
        const words = i.text.trim().split(/\s+/u).length;
        return [{ t: i.pos, kind: i.kind, size: Math.min(1, Math.log1p(words) / Math.log1p(120)), id: i.id }];
      }),
    [items],
  );

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    last.current = null;
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : now - last.current;
      last.current = now;
      setP((prev) => {
        const next = Math.min(1, prev + (dt * speed) / duration);
        if (next >= 1) queueMicrotask(stop);
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      last.current = null;
    };
  }, [playing, speed, stop]);

  const toggle = useCallback(() => {
    if (playing) return stop();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setP(1);
      return;
    }
    setFocus(null);
    setP((prev) => (prev >= 1 ? 0 : prev));
    setPlaying(true);
  }, [playing, stop]);

  const visible = items.filter((i) => i.pos <= p + 1e-9);

  // While playing, keep the newest line in view.
  useEffect(() => {
    if (playing && visible.length > prevVisible.current) {
      listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    prevVisible.current = visible.length;
  }, [playing, visible.length]);

  useEffect(() => {
    if (startItem) document.getElementById(`m-${startItem.id}`)?.scrollIntoView({ block: 'center' });
  }, [startItem]);

  const jump = useCallback(
    (dir: 1 | -1) => {
      stop();
      const stops = items.filter((i) => i.kind === 'prompt' || i.kind === 'correction').map((i) => i.pos);
      const next = dir === 1 ? stops.find((s) => s > p + 1e-6) ?? 1 : [...stops].reverse().find((s) => s < p - 1e-6) ?? 0;
      setP(next);
    },
    [items, p, stop],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight') jump(1);
      else if (e.key === 'ArrowLeft') jump(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, jump]);

  const scrubTo = (clientX: number) => {
    const r = stripRef.current?.getBoundingClientRect();
    if (!r) return;
    setP(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };

  return (
    <>
      <div className="sticky top-0 z-10 -mx-5 mb-8 border-b border-line bg-paper/90 px-5 py-3 backdrop-blur-md sm:-mx-14 sm:px-14">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-transform duration-[80ms] active:scale-95"
          >
            {playing ? (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><rect x="3" y="2.5" width="3.5" height="11" rx="1" /><rect x="9.5" y="2.5" width="3.5" height="11" rx="1" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" className="ml-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M4 2.8v10.4a.8.8 0 0 0 1.2.7l8.6-5.2a.8.8 0 0 0 0-1.4L5.2 2.1A.8.8 0 0 0 4 2.8z" /></svg>
            )}
          </button>
          <div
            ref={stripRef}
            className="min-w-0 flex-1 cursor-pointer touch-none"
            onPointerDown={(e) => {
              stop();
              e.currentTarget.setPointerCapture(e.pointerId);
              scrubTo(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) scrubTo(e.clientX);
            }}
            role="slider"
            aria-label="Replay position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(p * 100)}
            tabIndex={0}
          >
            <Strip marks={marks} x={identity} height={52} playhead={p} />
          </div>
          <button
            type="button"
            onClick={() => setSpeed(speed === 1 ? 3 : 1)}
            className="num hidden w-10 shrink-0 rounded-full py-1.5 text-center font-mono text-[12px] text-muted transition-colors hover:bg-sunk hover:text-ink sm:block"
            aria-label="Replay speed"
          >
            {speed}×
          </button>
        </div>
      </div>

      <ol ref={listRef} className="flex flex-col gap-7">
        {visible.map((item) => (
          <ReplayRow key={item.id} item={item} p={p} agent={agent} animate={playing} focused={focus === item.id} />
        ))}
      </ol>
      {p < 1 && !playing && (
        <button type="button" onClick={() => setP(1)} className="mt-8 text-[14px] font-medium text-ink underline decoration-line-strong underline-offset-4">
          Show the rest
        </button>
      )}
    </>
  );
}

function ReplayRow({ item, p, agent, animate, focused }: { item: ReplayItem; p: number; agent: 'claude' | 'codex'; animate: boolean; focused: boolean }) {
  const cls = `${animate ? 'arrive' : ''} scroll-mt-28`;
  if (item.kind === 'interrupt' || item.kind === 'rejected') {
    return (
      <li id={`m-${item.id}`} className={`${cls} flex items-center gap-3 text-[13px] text-mark`}>
        <span className="h-px w-6 bg-mark" aria-hidden />
        {item.kind === 'interrupt' ? 'You stopped it' : 'You rejected that tool call'}
        <span className="num font-mono text-[11.5px] text-faint">{item.time}</span>
      </li>
    );
  }

  if (item.kind === 'agent') {
    const tools = item.tools.filter((t) => t.pos <= p + 1e-9);
    return (
      <li id={`m-${item.id}`} className={`${cls} grid grid-cols-1 gap-2 sm:grid-cols-[116px_minmax(0,1fr)]`}>
        <Who label={agentName(agent)} time={item.time} icon={<AgentMark agent={agent} className="h-3 w-3" />} />
        <div className="min-w-0">
          {item.text && <Prose text={item.text} className="text-[15px] text-ink-2" />}
          {tools.length > 0 && (
            <ul className={`${item.text ? 'mt-3' : ''} flex flex-col gap-1 border-l border-line pl-3`}>
              {tools.map((t, i) => (
                <li key={i} className={`${animate ? 'arrive' : ''} flex min-w-0 items-baseline gap-2.5 font-mono text-[12.5px] leading-[1.6]`}>
                  <span className="shrink-0 text-ink-2">{t.name}</span>
                  <span className="truncate text-muted">{t.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </li>
    );
  }

  const correction = item.kind === 'correction';
  return (
    <li
      id={`m-${item.id}`}
      className={`${cls} grid grid-cols-1 gap-2 sm:grid-cols-[116px_minmax(0,1fr)] ${focused ? 'rounded-[10px] outline outline-2 outline-offset-8 outline-line-strong' : ''}`}
    >
      <Who label="You" time={item.time} />
      <div className={`min-w-0 ${correction && item.fix ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]' : ''}`}>
        <div className="min-w-0">
          {correction ? <RedPencil text={item.text} /> : <Prose text={item.text} className="text-[16px] text-ink" />}
          {correction && (
            <div className="mt-2 font-mono text-[11.5px] uppercase tracking-[0.1em] text-mark">
              {item.via === 'rejection' ? 'Correction · rejected a tool call' : item.via === 'interrupt' ? 'Correction · after you stopped it' : 'Correction'}
            </div>
          )}
        </div>
        {correction && item.fix && <FixNote fix={item.fix} animate={animate} />}
      </div>
    </li>
  );
}

function Who({ label, time, icon }: { label: string; time: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 pt-0.5 sm:flex-col sm:gap-0.5">
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        {icon}
        {label}
      </span>
      <span className="num font-mono text-[11.5px] text-faint">{time}</span>
    </div>
  );
}

function Prose({ text, className }: { text: string; className: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 700;
  return (
    <div className={className}>
      <p className="whitespace-pre-wrap break-words leading-[1.6]"><Inline text={long && !open ? `${text.slice(0, 640).trimEnd()}…` : text} /></p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-[13px] font-medium text-muted hover:text-ink">
          {open ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  );
}

// Your words with a hand-drawn red line under them, like an editor's mark.
function RedPencil({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-[16px] leading-[1.75] text-ink">
      <span
        className="bg-no-repeat pb-1"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 6' preserveAspectRatio='none'%3E%3Cpath d='M1 4 C 30 2, 60 5.5, 119 2.5' fill='none' stroke='%23c23b22' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E\")",
          backgroundSize: '100% 6px',
          backgroundPosition: '0 100%',
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
        }}
      >
        <Inline text={text} />
      </span>
    </p>
  );
}

function FixNote({ fix, animate }: { fix: NonNullable<ReplayItem['fix']>; animate: boolean }) {
  const label = fix.state === 'applied' ? 'Fixed in CLAUDE.md' : fix.state === 'covered' ? 'Already in CLAUDE.md' : 'Trace drafted a fix';
  return (
    <aside className={`${animate ? 'slide-in' : ''} self-start rounded-[10px] bg-raised p-4 shadow-float`}>
      <div className={`font-mono text-[11px] uppercase tracking-[0.12em] ${fix.state === 'applied' ? 'text-held' : 'text-muted'}`}>{label}</div>
      <p className="mt-2 text-[14px] leading-[1.5] text-ink"><Inline text={fix.line} /></p>
      <a href={`/fixes#fix-${fix.id}`} className="mt-3 inline-block text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
        You&apos;ve said this {fix.times} times
      </a>
    </aside>
  );
}
