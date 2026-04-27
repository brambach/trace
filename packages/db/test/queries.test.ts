import { describe, expect, it } from 'vitest';
import { getDb, closeDb } from '../src/index.js';
import { sessions } from '../src/index.js';

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
