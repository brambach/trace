import type { TraceDb } from '../client.js';

export interface PatternsData {
  total_user_prompts: number;
  median_word_count: number;
  share_under_10_words: number;
  prompt_anatomy: {
    has_file_path_pct: number;
    has_code_block_pct: number;
    has_error_message_pct: number;
    is_imperative_pct: number;
    is_interrogative_pct: number;
  };
  one_shot_rate_pct: number;
  one_shot_trend: number[];
  retry_phrases: { phrase: string; count: number; sessions: number }[];
  drifted_sessions: DriftedSession[];
  length_histogram: number[];
}

export interface DriftedSession {
  id: string;
  project_name: string;
  ai_title: string | null;
  ended_at: string;
  flag: 'DRIFT' | 'VAGUE' | 'SHIFTING';
  reason: string;
}

export function getPatterns(db: TraceDb, days: number = 14): PatternsData {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();

  type WordRow = { word_count: number };
  const userPrompts = db.sqlite
    .prepare<[string], WordRow>(
      `SELECT word_count FROM messages WHERE role = 'user' AND timestamp >= ?`,
    )
    .all(sinceIso);

  const total = userPrompts.length;
  const median = (() => {
    if (total === 0) return 0;
    const sorted = [...userPrompts].map((r) => r.word_count).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
      : sorted[mid]!;
  })();
  const under10 = userPrompts.filter((r) => r.word_count > 0 && r.word_count < 10).length;
  const share_under_10_words = total === 0 ? 0 : Math.round((100 * under10) / total);

  type AnatomyRow = {
    fp: number;
    cb: number;
    err: number;
    interr: number;
    total: number;
  };
  const a =
    db.sqlite
      .prepare<[string], AnatomyRow>(
        `SELECT
           SUM(has_file_path)     AS fp,
           SUM(has_code_block)    AS cb,
           SUM(has_error_message) AS err,
           SUM(is_interrogative)  AS interr,
           COUNT(*) AS total
         FROM messages WHERE role = 'user' AND timestamp >= ?`,
      )
      .get(sinceIso) ?? { fp: 0, cb: 0, err: 0, interr: 0, total: 0 };

  const pct = (n: number) => (a.total === 0 ? 0 : Math.round((100 * n) / a.total));

  const prompt_anatomy = {
    has_file_path_pct: pct(a.fp),
    has_code_block_pct: pct(a.cb),
    has_error_message_pct: pct(a.err),
    is_imperative_pct: a.total === 0 ? 0 : 100 - pct(a.interr),
    is_interrogative_pct: pct(a.interr),
  };

  type TurnRow = { turn_count: number };
  const sessionTurns = db.sqlite
    .prepare<[string], TurnRow>(
      `SELECT turn_count FROM sessions WHERE ended_at >= ? AND turn_count > 0`,
    )
    .all(sinceIso);

  const oneShot = sessionTurns.filter((r) => r.turn_count <= 3).length;
  const one_shot_rate_pct =
    sessionTurns.length === 0 ? 0 : Math.round((100 * oneShot) / sessionTurns.length);

  type WeeklyRow = { week: string; total: number; oneshot: number };
  const weekly = db.sqlite
    .prepare<[number], WeeklyRow>(
      `SELECT
         strftime('%Y-%W', ended_at) AS week,
         COUNT(*) AS total,
         SUM(CASE WHEN turn_count <= 3 THEN 1 ELSE 0 END) AS oneshot
       FROM sessions WHERE turn_count > 0
       GROUP BY week
       ORDER BY week DESC
       LIMIT ?`,
    )
    .all(6);

  const one_shot_trend = weekly
    .reverse()
    .map((w) => (w.total === 0 ? 0 : Math.round((100 * w.oneshot) / w.total)));

  const length_histogram = computeLengthHistogram(userPrompts.map((r) => r.word_count));
  const retry_phrases = computeRetryPhrases(db, sinceIso);
  const drifted_sessions = computeDriftedSessions(db, sinceIso);

  return {
    total_user_prompts: total,
    median_word_count: median,
    share_under_10_words,
    prompt_anatomy,
    one_shot_rate_pct,
    one_shot_trend,
    retry_phrases,
    drifted_sessions,
    length_histogram,
  };
}

function computeLengthHistogram(words: number[]): number[] {
  const bins = new Array(20).fill(0);
  for (const w of words) {
    if (w <= 0) continue;
    const idx = Math.min(19, Math.floor((w - 1) / 10));
    bins[idx]! += 1;
  }
  return bins;
}

function computeRetryPhrases(db: TraceDb, sinceIso: string) {
  const phrases: { phrase: string; like: string }[] = [
    { phrase: 'no, not that', like: '%no, not that%' },
    { phrase: 'actually,', like: '%actually,%' },
    { phrase: 'try again', like: '%try again%' },
    { phrase: "that's wrong", like: "%that's wrong%" },
    { phrase: 'no, do', like: '%no, do%' },
  ];

  type Row = { count: number; sessions: number };
  return phrases
    .map((p) => {
      const r =
        db.sqlite
          .prepare<[string, string], Row>(
            `SELECT
               COUNT(*) AS count,
               COUNT(DISTINCT session_id) AS sessions
             FROM messages
             WHERE role = 'user' AND timestamp >= ? AND lower(content_text) LIKE ?`,
          )
          .get(sinceIso, p.like) ?? { count: 0, sessions: 0 };
      return { phrase: p.phrase, count: r.count, sessions: r.sessions };
    })
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function computeDriftedSessions(db: TraceDb, sinceIso: string): DriftedSession[] {
  type Row = {
    id: string;
    project_name: string;
    ai_title: string | null;
    ended_at: string;
    retry_signal_count: number;
    turn_count: number;
    avg_user_words: number | null;
    actually_count: number;
  };

  const rows = db.sqlite
    .prepare<[string, string], Row>(
      `SELECT
         s.id, s.project_name, s.ai_title, s.ended_at,
         s.retry_signal_count, s.turn_count,
         (SELECT AVG(word_count) FROM messages m WHERE m.session_id = s.id AND m.role = 'user') AS avg_user_words,
         (SELECT COUNT(*) FROM messages m
            WHERE m.session_id = s.id AND m.role = 'user' AND lower(m.content_text) LIKE ?) AS actually_count
       FROM sessions s
       WHERE s.ended_at >= ?`,
    )
    .all('%actually,%', sinceIso);

  const flagged: DriftedSession[] = [];
  for (const r of rows) {
    if (r.retry_signal_count >= 5) {
      flagged.push({
        id: r.id,
        project_name: r.project_name,
        ai_title: r.ai_title,
        ended_at: r.ended_at,
        flag: 'DRIFT',
        reason: `${r.retry_signal_count} retry signals in ${r.turn_count} turns.`,
      });
      continue;
    }
    if (r.turn_count >= 4 && (r.avg_user_words ?? 0) < 20) {
      flagged.push({
        id: r.id,
        project_name: r.project_name,
        ai_title: r.ai_title,
        ended_at: r.ended_at,
        flag: 'VAGUE',
        reason: `Avg user-prompt length ${Math.round(r.avg_user_words ?? 0)} words across ${r.turn_count} turns.`,
      });
      continue;
    }
    if (r.actually_count >= 4) {
      flagged.push({
        id: r.id,
        project_name: r.project_name,
        ai_title: r.ai_title,
        ended_at: r.ended_at,
        flag: 'SHIFTING',
        reason: `${r.actually_count} "actually," redirects.`,
      });
    }
  }
  return flagged
    .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
    .slice(0, 10);
}
