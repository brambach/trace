# Trace

A second brain for my AI-assisted coding. Trace tails the JSONL session files Claude Code writes to `~/.claude/projects/`, parses them into a queryable store, and surfaces what I built and where each project stands. Recall and project status are the centerpiece. Charts are ambient texture, not function. Built for me first. Will likely open source on GitHub once v1 is stable. Possible product later, but that decision waits until I've used it for a month and the GitHub repo gets organic signal.

The full design is in `docs/superpowers/specs/2026-04-26-trace-design.md`. CLAUDE.md is the working agreement; the spec is the source of truth for scope and architecture.

## Tech stack

- **Runtime**: Node.js (latest LTS), TypeScript everywhere, strict mode
- **File watcher**: `chokidar` watching `~/.claude/projects/`
- **Storage**: SQLite via `better-sqlite3`. Schema managed with Drizzle ORM
- **Dashboard**: Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
- **Charts**: Recharts unless something specific demands d3
- **AI summaries**: Anthropic API. Use `claude-haiku-4-5-20251001` for daily summaries (cheap, fast). Use `claude-sonnet-4-6` for weekly synthesis where pattern recognition matters more
- **Background jobs**: `node-cron` for scheduling. Watcher runs as a launchd agent on macOS
- **Auth**: None for v1. Single-user, single-machine. Add Clerk only if this becomes multi-user

Do not suggest: Postgres, Prisma, separate frontend/backend frameworks, Docker, Kubernetes, message queues, Redis, microservices, GraphQL. One repo, one machine, one user.

## Architecture

Three processes:

1. **Watcher**: Subscribes to filesystem events on `~/.claude/projects/`. On change, parses the appended JSONL lines and inserts into SQLite. Tracks each session file's last-read offset so reruns are idempotent. Runs as a launchd agent.

2. **Summarizer**: Cron at 9pm local. Pulls the day's rows, formats a structured prompt, sends to Claude. Stores the response in a `summaries` table. Also writes a markdown file to `~/Trace/summaries/YYYY-MM-DD.md` for offline reading. Weekly variant runs Sunday 9pm.

3. **Dashboard**: Next.js app reading from the same SQLite database. Read-only against the data layer.

## Schema (first cut, evolve as needed)

- `sessions`: id, project_path, started_at, ended_at, message_count, tool_call_count
- `messages`: id, session_id, role, content, timestamp, token_count_estimate
- `tool_calls`: id, session_id, tool_name, arguments_json, result_summary, timestamp
- `summaries`: id, period (daily|weekly|monthly), date, content_md, model_used, generated_at
- `file_offsets`: session_file_path, last_byte_read, last_processed_at

## Repo layout

```
trace/
  apps/
    dashboard/         # Next.js 15
    watcher/           # Long-running file watcher
    summarizer/        # Cron-triggered summary job
  packages/
    db/                # Drizzle schema and queries
    parser/            # Claude Code JSONL parsing logic
    shared/            # Types, constants
```

pnpm workspaces.

## v1 scope

Build:

- File watcher writing to SQLite (with FTS5 on message text)
- Three pillars in the dashboard:
  - Recall: search across every session, session detail reading view
  - Portfolio: today (masthead + project ledger), projects (portfolio grid), project detail
  - Patterns: deterministic prompt-feature surface (length distribution, anatomy, one-shot rate, retry phrases, drifted sessions)
- Daily and weekly summary cron with markdown output (Weekend 2)
- Tool call extraction at parse time, surfaced Weekend 2

Patterns counts features, never scores quality. LLM-judged coaching is a v2 idea ("coach"), held until v1 has been used daily for a month.

Skip:

- Claude.ai chat ingestion (manual export comes later, browser extension much later)
- Multi-user accounts
- Public deploy
- Export, sharing, social features
- Slack or Discord integration
- Mobile anything
- A landing page or pricing page

## Code conventions

- TypeScript strict. No `any`. Use `unknown` and narrow when the type is genuinely unknown
- Functional style by default. Classes only when encapsulating real state (e.g. a connection)
- Named exports preferred
- File names: kebab-case for everything except React components (PascalCase)
- One concept per file. Files over 200 lines usually want splitting
- Comments only when the why is non-obvious. Skip comments that restate the code
- Errors: throw typed Error subclasses, never strings or untyped objects

## Prose conventions

When generating any prose for this project (READMEs, error messages, the prompt sent to the summarizer, commit messages, future marketing copy), write like Bryce writes:

- No em dashes anywhere. Use periods, commas, parentheses
- Active voice. Every sentence has a human subject doing something
- Cut filler. No "simply", "just", "really", "very", "actually", "essentially"
- Specific over general. Name the thing. No vague declaratives like "the implications are significant"
- Vary rhythm. Mix sentence lengths. Don't end every paragraph with a punchy one-liner
- Trust the reader. State facts directly. Skip softening and hand-holding
- No throat-clearing openers ("Here's the thing...", "It's important to note...")
- No binary contrasts ("not X, it's Y"). State Y directly

## Anti-patterns to push back on

If I propose any of these, push back before writing code:

- Refactoring before there's signal. v1 is meant to be ugly, fast, and used. Refactor proposals before daily use are premature
- Building features outside the v1 scope above. Scope creep is the most likely failure mode for this project
- Generic dev-tool aesthetics. The dashboard should feel distinctive. Not a Tailwind admin template
- Designing the schema for future flexibility I don't yet need. Add columns when I need them
- Premature performance optimization. SQLite handles billions of rows. We will not need it
- Adding configuration knobs without a real second use case driving them

## Git workflow

Commit and push to the GitHub remote (`brambach/trace`) whenever a coherent unit of work lands and the tree is in a working state. Examples that warrant a commit: scaffolding the monorepo, the watcher writing rows end to end, a package's tests going green, a dashboard view shipping. Skip commits for broken intermediate states. Conventional commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`). The prose conventions above apply to commit messages.

## Current focus

Weekend 1: watcher plus SQLite plus minimal dashboard reading from it. No summaries yet. Goal is to prove the data pipeline end to end and see the first chart populate from real data.

Weekend 2: summarizer cron, dashboard polish, time-of-day heatmap.

After that: I use it for two weeks before deciding what to build next.