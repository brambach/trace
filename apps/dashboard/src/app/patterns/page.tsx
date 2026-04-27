import { getPatterns } from '@trace/db';
import { db } from '@/lib/db';
import { Masthead } from '@/components/Masthead';
import { LengthHistogram } from '@/components/LengthHistogram';
import { PatternBar } from '@/components/PatternBar';
import { DriftRow } from '@/components/DriftRow';
import { derivePatternsHeadlineDeck } from '@/lib/patterns-derived';

export const dynamic = 'force-dynamic';

export default function PatternsPage() {
  const p = getPatterns(db(), 14);
  const { headline, deck } = derivePatternsHeadlineDeck(p);

  return (
    <>
      <Masthead eyebrow="Your prompting · last 14 days" headline={headline} deck={deck} />
      <div className="reveal r3 rule mb-6" />

      <section className="reveal r3">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">Prompt length</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">
            14 days · {p.total_user_prompts} user prompts
          </span>
        </div>
        <LengthHistogram bins={p.length_histogram} />
        <div className="mt-4 grid grid-cols-3 gap-6 font-mono text-[11px] tracking-[0.04em] text-dim">
          <div>
            <span className="block font-serif text-[22px] tracking-[-0.01em] text-ink serif-numerals">
              {p.median_word_count}
            </span>
            Median words
          </div>
          <div>
            <span className="block font-serif text-[22px] tracking-[-0.01em] text-ink serif-numerals">
              {p.share_under_10_words}%
            </span>
            Under 10 words
          </div>
          <div>
            <span className="block font-serif text-[22px] tracking-[-0.01em] text-ink serif-numerals">
              {p.one_shot_rate_pct}%
            </span>
            One-shot rate (&le;3 turns)
          </div>
        </div>
      </section>

      <section className="reveal r4 mt-9">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">Prompt anatomy</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">
            Share of prompts containing each signal
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-7">
          <PatternBar name="File path" pct={p.prompt_anatomy.has_file_path_pct} emphasis />
          <PatternBar name="Code block" pct={p.prompt_anatomy.has_code_block_pct} emphasis />
          <PatternBar name="Error message" pct={p.prompt_anatomy.has_error_message_pct} />
          <PatternBar name="Imperative" pct={p.prompt_anatomy.is_imperative_pct} />
          <PatternBar name="Question, no context" pct={p.prompt_anatomy.is_interrogative_pct} />
        </div>
      </section>

      <section className="reveal r5 mt-9">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">
            Where you redirect Claude
          </h2>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">
            Most-used retry phrases
          </span>
        </div>
        <div className="grid grid-cols-[1.5fr_1fr] gap-9">
          <div className="flex flex-col">
            {p.retry_phrases.length === 0 && (
              <p className="py-3 italic text-dim">No retry phrases detected yet.</p>
            )}
            {p.retry_phrases.map((r, i) => (
              <div key={r.phrase} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 border-b border-rule py-2.5">
                <span className="w-6 font-mono text-[10px] tracking-[0.18em] text-dim">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-serif italic text-base">&quot;{r.phrase}&quot;</span>
                <span className="font-mono text-[11px] tracking-[0.06em] text-dim">
                  <strong className="font-serif text-base font-normal tracking-[-0.01em] text-ink">
                    {r.count}
                  </strong>{' '}
                  · {r.sessions} session{r.sessions === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
          <aside className="border-l-2 border-accent bg-[rgba(200,155,123,0.08)] p-4 font-serif italic text-[15.5px] leading-snug text-[#2b2a28]">
            <strong className="not-italic text-ink">Heuristic.</strong> Counts come straight from local data, no scoring by AI. Adding constraints up front tends to save 2 to 4 turns when these phrases would otherwise appear.
            <span className="mt-2 block font-mono text-[9.5px] uppercase tracking-[0.18em] text-dim">
              Derived · not a confident causal claim
            </span>
          </aside>
        </div>
      </section>

      <section className="reveal r6 mt-9">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">Sessions that drifted</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">
            Likely doom loops · click to review
          </span>
        </div>
        <div className="flex flex-col">
          {p.drifted_sessions.length === 0 && (
            <p className="py-3 italic text-dim">No drifted sessions in the last 14 days.</p>
          )}
          {p.drifted_sessions.map((s) => (
            <DriftRow
              key={s.id}
              id={s.id}
              whenIso={s.ended_at}
              project={s.project_name}
              reason={s.reason}
              flag={s.flag}
            />
          ))}
        </div>
      </section>

      <p className="reveal r7 mt-12 border-t border-rule pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
        All metrics derived from local data, no scoring by AI
      </p>
    </>
  );
}
