'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { applyFix, dismissFix, openFixPr, restoreFix, type ActionResult } from '@/app/fixes/actions';

type Phase = 'idle' | 'busy' | 'written' | 'dismissed' | 'error';

export function FixActions({
  id,
  path,
  added,
  creates,
  pr,
}: {
  id: string;
  path: string;
  added: string[];
  creates: boolean;
  pr: { ok: boolean; reason?: string };
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [, startTransition] = useTransition();

  const run = (action: (id: string) => Promise<ActionResult>, next: Phase) => {
    setPhase('busy');
    startTransition(async () => {
      const r = await action(id);
      setResult(r);
      setPhase(r.ok ? next : 'error');
      // Let the line write itself in before the card moves to Applied.
      if (r.ok) setTimeout(() => router.refresh(), 2400);
    });
  };

  const written = phase === 'written';

  return (
    <div className="mt-6">
      <div className="overflow-hidden rounded-[10px] bg-sunk">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 font-mono text-[12px] text-muted">
          <span className="truncate">{path}</span>
          <span className="shrink-0">{creates ? 'new file' : written ? 'saved' : 'draft'}</span>
        </div>
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-[1.7] text-ink">
          {added.map((line, i) => (
            <span
              key={i}
              className="block"
              style={
                written
                  ? { animation: `write-in 520ms var(--ease-out) ${i * 90}ms both` }
                  : undefined
              }
            >
              <span className={`mr-3 select-none ${written ? 'text-held' : 'text-faint'}`}>+</span>
              {line || ' '}
            </span>
          ))}
        </pre>
      </div>

      {phase === 'idle' || phase === 'busy' || phase === 'error' ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={phase === 'busy'}
            onClick={() => run(applyFix, 'written')}
            className="rounded-full bg-primary px-4 py-2 text-[14px] font-medium text-on-primary transition-[transform,opacity] duration-[80ms] active:scale-[0.97] disabled:opacity-60"
          >
            Write it to CLAUDE.md
          </button>
          {pr.ok && (
            <button
              type="button"
              disabled={phase === 'busy'}
              onClick={() => run(openFixPr, 'written')}
              className="rounded-full px-4 py-2 text-[14px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-[140ms] hover:bg-sunk disabled:opacity-60"
            >
              Open a PR
            </button>
          )}
          <button
            type="button"
            disabled={phase === 'busy'}
            onClick={() => run(dismissFix, 'dismissed')}
            className="px-3 py-2 text-[14px] text-muted transition-colors duration-[140ms] hover:text-ink disabled:opacity-60"
          >
            Not useful
          </button>
          {phase === 'error' && result && <p className="w-full pt-1 text-[13.5px] text-mark">{result.message}</p>}
        </div>
      ) : (
        <p className="arrive mt-4 flex items-center gap-2 text-[14px] text-ink-2">
          {phase === 'written' && (
            <svg viewBox="0 0 16 16" className="h-4 w-4 text-held" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 8.5l3.2 3L13 4.5" />
            </svg>
          )}
          {result?.message}
          {result?.url && (
            <a href={result.url} className="font-medium text-ink underline decoration-line-strong underline-offset-4">View the PR</a>
          )}
        </p>
      )}
    </div>
  );
}

export function RestoreButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await restoreFix(id);
          router.refresh();
        })
      }
      className="font-medium text-ink underline decoration-line-strong underline-offset-4 disabled:opacity-60"
    >
      Bring it back
    </button>
  );
}
