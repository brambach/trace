const STOPWORDS = new Set(
  `a an the to of in on for and or but is are be it its it's this that these those i i'm you you're we me my your our
   with as at by from so just do does did doing don't dont not no never always stop use using please again can could would
   should will been was were have has had there here then than what why how when which who now also any all some more very
   really actually like make sure thing things stuff one get got go going keep okay ok yeah yes hey same way them they their
   avoid only prefer instead`.split(/\s+/u),
);

export function contentTokens(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9][a-z0-9'._/-]*/gu) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    const clean = w.replace(/[.']+$/u, '');
    if (clean.length < 2 || STOPWORDS.has(clean)) continue;
    out.add(stem(clean));
  }
  return [...out];
}

function stem(w: string): string {
  if (w.length <= 4 || /[/.]/u.test(w)) return w;
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) return w.slice(0, -suffix.length);
  }
  return w;
}

export function jaccard(a: string[], b: string[]): { score: number; shared: number } {
  const sa = new Set(a);
  let shared = 0;
  for (const t of b) if (sa.has(t)) shared++;
  const union = new Set([...a, ...b]).size;
  return { score: union === 0 ? 0 : shared / union, shared };
}

export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
