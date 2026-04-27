export type TraceDb = unknown;
export function getDb(_path?: string): TraceDb {
  throw new Error('not implemented');
}
export function closeDb(_db: TraceDb): void {
  throw new Error('not implemented');
}
