import { getDb, closeDb } from '@trace/db';
import { TRACE_DB_PATH } from '@trace/shared';
import { writeLetter } from './letter.js';

const db = getDb(TRACE_DB_PATH);
console.log(`Wrote ${writeLetter(db)}`);
closeDb(db);
