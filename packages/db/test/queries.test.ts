import { describe, expect, it } from 'vitest';
import { getDb, closeDb } from '../src/client.js';
import { sessions } from '../src/index.js';
import {
  getTodaySummary,
  getProjectLedgerForToday,
  getProjectCards,
  searchMessages,
  getPatterns,
  getSessionDetail,
} from '../src/index.js';

function seed(db: ReturnType<typeof getDb>, dayIso: string) {
  const tonight = `${dayIso}T22:00:00.000Z`;
  const earlier = `${dayIso}T20:00:00.000Z`;
  const sql = db.sqlite;

  sql.exec(`
    INSERT INTO sessions (id, cwd, project_name, ai_title, first_user_message, started_at, ended_at, message_count, turn_count, retry_signal_count)
    VALUES
      ('s1', '/Users/me/projects/trace', 'trace', 'Editorial direction',
       'lets brainstorm', '${earlier}', '${tonight}', 4, 2, 0),
      ('s2', '/Users/me/projects/throughline', 'throughline', 'Reducer fix',
       'fix the reducer', '${earlier}', '${tonight}', 2, 1, 0);

    INSERT INTO messages (id, session_id, role, content, content_text, timestamp, word_count, has_file_path)
    VALUES
      ('m1', 's1', 'user',      '{}', 'Update src/parser.ts to handle null timestamps', '${earlier}', 6, 1),
      ('m2', 's1', 'assistant', '{}', 'Reading file now',                                '${earlier}', 3, 0),
      ('m3', 's1', 'user',      '{}', 'thanks',                                          '${tonight}', 1, 0),
      ('m4', 's1', 'assistant', '{}', 'You are welcome',                                 '${tonight}', 3, 0),
      ('m5', 's2', 'user',      '{}', 'fix the reducer',                                 '${earlier}', 3, 0),
      ('m6', 's2', 'assistant', '{}', 'Fixed.',                                          '${earlier}', 1, 0);
  `);
}

describe('db init', () => {
  it('opens an in-memory database with the schema applied', () => {
    const db = getDb(':memory:');
    try {
      const rows = db.select().from(sessions).all();
      expect(rows).toEqual([]);
      const fts = db.sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='messages_fts'`)
        .all();
      expect(fts).toHaveLength(1);
    } finally {
      closeDb(db);
    }
  });
});

describe('queries', () => {
  it('getTodaySummary aggregates correctly', () => {
    const db = getDb(':memory:');
    try {
      const today = new Date().toISOString().slice(0, 10);
      seed(db, today);
      const summary = getTodaySummary(db, today);
      expect(summary.message_count).toBe(6);
      expect(summary.session_count).toBe(2);
      expect(summary.headline).toBe('Editorial direction');
    } finally {
      closeDb(db);
    }
  });

  it('getProjectLedgerForToday lists active projects with last_touched and ai_title', () => {
    const db = getDb(':memory:');
    try {
      const today = new Date().toISOString().slice(0, 10);
      seed(db, today);
      const ledger = getProjectLedgerForToday(db, today);
      expect(ledger.map((r) => r.project_name).sort()).toEqual(['throughline', 'trace']);
      const trace = ledger.find((r) => r.project_name === 'trace');
      expect(trace?.ai_title).toBe('Editorial direction');
    } finally {
      closeDb(db);
    }
  });

  it('getProjectCards includes spark length 14', () => {
    const db = getDb(':memory:');
    try {
      const today = new Date().toISOString().slice(0, 10);
      seed(db, today);
      const cards = getProjectCards(db, 14);
      expect(cards.length).toBeGreaterThan(0);
      expect(cards[0]?.spark.length).toBe(14);
    } finally {
      closeDb(db);
    }
  });

  it('searchMessages matches words in content_text', () => {
    const db = getDb(':memory:');
    try {
      const today = new Date().toISOString().slice(0, 10);
      seed(db, today);
      const results = searchMessages(db, 'parser');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.snippet).toContain('parser');
    } finally {
      closeDb(db);
    }
  });

  it('getPatterns returns shape', () => {
    const db = getDb(':memory:');
    try {
      const today = new Date().toISOString().slice(0, 10);
      seed(db, today);
      const p = getPatterns(db, 14);
      expect(p.total_user_prompts).toBeGreaterThanOrEqual(3);
      expect(p.length_histogram.length).toBe(20);
    } finally {
      closeDb(db);
    }
  });

  it('getSessionDetail returns ordered messages', () => {
    const db = getDb(':memory:');
    try {
      const today = new Date().toISOString().slice(0, 10);
      seed(db, today);
      const sd = getSessionDetail(db, 's1');
      expect(sd?.messages.length).toBe(4);
      expect(sd?.messages[0]?.role).toBe('user');
    } finally {
      closeDb(db);
    }
  });
});
