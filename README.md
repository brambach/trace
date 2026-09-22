# Trace

A second brain for AI-assisted coding. Trace tails the JSONL session files Claude Code writes to `~/.claude/projects/`, parses them into a queryable SQLite store, and surfaces what you built and where each project stands.

Built for personal use first. Single user, single machine, no auth.

## Status

Pre-v1. Vertical slice running locally: watcher writes rows in real time, dashboard reads from the same database with five live surfaces (Today, Search, Projects, Project detail, Patterns) and one stub (Session detail).

## Run it

```bash
pnpm install
pnpm dev
```

Two processes start: the watcher (tails `~/.claude/projects/`) and the dashboard (Next.js on http://localhost:3000). Use Claude Code in another terminal and watch the dashboard fill in.

## Stack

Node.js 22, TypeScript strict, pnpm workspaces, SQLite via `better-sqlite3`, Drizzle ORM, FTS5 for full-text search, chokidar, Next.js 15 App Router server components, Tailwind CSS, Recharts (used minimally).

## Layout

```
apps/
  dashboard/    Next.js dashboard reading from SQLite
  watcher/      Long-running file watcher
packages/
  db/           Drizzle schema + queries + migrations
  parser/       JSONL line parsing + prompt-feature computation
  shared/       Zod schemas, types, paths
```

## Design

The full v1 spec lives at [`docs/superpowers/specs/2026-04-26-trace-design.md`](docs/superpowers/specs/2026-04-26-trace-design.md). The implementation plan is at [`docs/superpowers/plans/2026-04-26-trace-v1-vertical-slice.md`](docs/superpowers/plans/2026-04-26-trace-v1-vertical-slice.md).

## License

MIT. See [LICENSE](LICENSE).
