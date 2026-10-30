// Phrases you use when you redirect the agent. Each one is anchored so that
// ordinary instructions ("don't forget to add tests") don't count.
export const RETRY_PHRASE_PATTERNS: RegExp[] = [
  /\bno,?\s+not\s+that\b/iu,
  /^\s*actually,?\s/iu,
  /\btry\s+again\b/iu,
  /\bthat'?s\s+(?:wrong|not\s+(?:it|right|what))\b/iu,
  /\bnot\s+what\s+i\s+(?:asked|wanted|meant)\b/iu,
  /\bno,?\s+do\b/iu,
  /^\s*(?:no|nope|stop|wait)\b[,.!]?\s/iu,
  /\bi\s+(?:said|told\s+you|already\s+said)\b/iu,
  /\byou\s+(?:should(?:n'?t)?\s+have|didn'?t|forgot|keep)\b/iu,
  /\bwhy\s+(?:did|are)\s+you\b/iu,
  /\b(?:use|run)\s+\S+(?:\s+\S+)?\s*,?\s+not\s+\S+/iu,
  /\bnot\s+\S+,\s*(?:use|run)\b/iu,
  /\binstead\b.*\bnot\b|\bnot\b.*\binstead\b/iu,
  /^\s*(?:don'?t|do\s+not|never)\s+\w+/iu,
  /\bagain[.!]*\s*$/iu,
  /^\s*again\b/iu,
  /\binstead\b/iu,
  /\bwe\s+(?:use|don'?t\s+use)\b/iu,
  /^\s*stop\s+\w+ing\b/iu,
];

export function matchesRetry(text: string): boolean {
  for (const re of RETRY_PHRASE_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}
