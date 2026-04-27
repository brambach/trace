export const RETRY_PHRASE_PATTERNS: RegExp[] = [
  /\bno,?\s+not\s+that\b/iu,
  /^\s*actually,?\s/iu,
  /\btry\s+again\b/iu,
  /\bthat'?s\s+wrong\b/iu,
  /\bnot\s+what\s+i\s+(?:asked|wanted|meant)\b/iu,
  /\bno,?\s+do\b/iu,
];

export function matchesRetry(text: string): boolean {
  for (const re of RETRY_PHRASE_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}
