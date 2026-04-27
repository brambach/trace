# Trace

A passive analytics layer for Claude Code usage. Trace tails the JSONL session files Claude Code writes to `~/.claude/projects/`, stores them in SQLite, and surfaces patterns in prompting and tool usage over time.

Built for personal use first. Single user, single machine, no auth.

## Status

Pre-v1. Watcher, summarizer, and dashboard in active development.

## Stack

Node.js, TypeScript, SQLite (`better-sqlite3`), Drizzle, Next.js 15, Tailwind, shadcn/ui, Recharts. pnpm workspaces. Watcher runs as a launchd agent on macOS.

## Layout

```
apps/
  dashboard/    Next.js dashboard reading from SQLite
  watcher/      Long-running file watcher (launchd)
  summarizer/   Cron job that generates daily and weekly summaries
packages/
  db/           Drizzle schema and queries
  parser/       Claude Code JSONL parsing
  shared/       Types, constants
```

## License

MIT (planned, once made public).
