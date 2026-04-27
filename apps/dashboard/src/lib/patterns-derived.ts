import type { PatternsData } from '@trace/db';

export function derivePatternsHeadlineDeck(p: PatternsData): { headline: string; deck: string } {
  if (p.total_user_prompts === 0) {
    return {
      headline: 'No prompts yet.',
      deck: 'Use Claude Code for a few sessions and this page fills in.',
    };
  }
  const fp = p.prompt_anatomy.has_file_path_pct;
  const oneShot = p.one_shot_rate_pct;
  const median = p.median_word_count;
  const headline =
    median >= 50
      ? 'Your prompts are leaning long and specific.'
      : median >= 20
        ? 'Your prompts are getting more concrete.'
        : 'Your prompts are short. Concrete tends to land faster.';
  const deck = `${fp}% include a file path. One-shot success at ${oneShot}%. Median prompt length: ${median} words across ${p.total_user_prompts} prompts in the last 14 days.`;
  return { headline, deck };
}
