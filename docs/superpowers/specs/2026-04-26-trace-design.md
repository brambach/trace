# Trace v1 Design

**Date:** 2026-04-26
**Status:** Approved (pending user review of this doc)

## What Trace is

A second brain for AI-assisted coding. Trace tails the JSONL session files Claude Code writes to `~/.claude/projects/`, parses them into a queryable store, and turns the chaos of dozens of half-finished projects into a single readable surface: what you built, where each project stands, and how to find anything you ever did.

The original framing was "passive analytics layer." That was the wrong centerpiece. Charts of message counts and token estimates are vanity for a single user. The right centerpiece is **recall and project status**. The data Trace already captures is rich enough to support that without any extra instrumentation.

## Goal

When I open Trace, four things should happen in order:

1. I see a one-paragraph picture of what I worked on today, by project.
2. I see the live status of every project I'm building with Claude: last touched, current focus, open threads.
3. I can search the full text of every session I've ever had and click straight to the moment I want.
4. I can see how my prompting is changing over time and which sessions drifted.

That's the product. Three pillars: **Recall**, **Portfolio**, **Patterns**.

## Non-goals

- Multi-user, accounts, hosted deploy. Single user, single machine, no auth.
- Real-time session-quality scoring. v1 Patterns is retrospective and deterministic. Live coaching is the v2 ("coach") idea, held in reserve.
- LLM-judged quality scores in v1. Patterns counts deterministic features (length, file paths, retry phrases). Coach-flavored narrative comes from the summarizer (Weekend 2) and is clearly labeled as AI-generated, not a confident causal claim.
- Charts as a centerpiece of any view. Charts are ambient texture, not function.
- Any UI that asks me to type into Trace. Trace reads from disk. It never asks me to log anything.
- Public landing page, pricing, sharing, social.

## Audience

Me, first. Heavy Claude Code users second. The thing I want is the thing they want: an answer to "wait, how did I solve that last time" and a way to keep track of which of my projects is actually moving.

## Architecture

Three processes by Weekend 2. Two for the Weekend 1 vertical slice.

- **`watcher`** — chokidar on `~/.claude/projects/`. On each file change, reads from the offset stored in `file_offsets`, parses each new line, dispatches to the right insert. Rerunning replays from the saved offset; conflict-on-uuid no-ops keep it idempotent. By Weekend 2, runs as a launchd agent.
- **`summarizer`** — node-cron, 9pm local. Pulls today's rows, builds a structured prompt (with a per-project section), calls the Anthropic API with `claude-haiku-4-5-20251001` for daily and `claude-sonnet-4-6` for the Sunday weekly synthesis. Writes the response to `summaries` and to a markdown file at `~/Trace/summaries/YYYY-MM-DD.md`. Not in the Weekend 1 slice.
- **`dashboard`** — Next.js 15, App Router, server components reading SQLite directly via the shared `db` package. No API layer.

## Repo layout

pnpm workspaces.

```
apps/
  dashboard/      Next.js 15
  watcher/        chokidar + parser + db inserts
  summarizer/     cron + Anthropic API (Weekend 2)
packages/
  db/             Drizzle schema, migrations, query helpers, sqlite path constant
  parser/         JSONL line → typed events; pure functions, fully unit-tested
  shared/         Zod schemas for the JSONL line shapes, types, constants
```

`packages/parser` is the only package with tests in v1. The watcher glues. The dashboard reads.

## Data

### JSONL shape

Real Claude Code session files contain a mix of line types. The ones that matter for v1:

- `user` and `assistant` — each carries `sessionId`, `timestamp`, `message`, `cwd`, `gitBranch`, `parentUuid`, `uuid`, `version`. These are the conversation.
- `attachment` — hook events attached to a turn. Useful for context, ignored in v1 storage.
- `ai-title` — Claude's auto-generated title for the session. Used as the headline.
- `last-prompt` — Claude's record of the most recent user prompt. Useful as a fallback.
- `queue-operation`, `file-history-snapshot` — internal noise, dropped at parse time.

The parser handles the line shape that exists today. When new types appear, they get logged and dropped, never crash the watcher.

### Schema (Drizzle, SQLite)

```ts
sessions
  id (uuid, PK), cwd, project_name, git_branch,
  ai_title, first_user_message,
  started_at, ended_at,
  message_count, turn_count, tool_call_count,
  ended_without_assistant_reply (bool, derived),
  -- Patterns features (computed when session closes)
  assistant_question_count (int),
  first_response_was_tool (bool),
  retry_signal_count (int)

messages
  id (uuid, PK), session_id (FK), role,
  content (raw JSON), content_text (flattened plain text),
  cwd, git_branch, timestamp,
  token_count_estimate,
  -- Patterns features (computed at insert)
  word_count (int),
  has_file_path (bool),
  has_code_block (bool),
  has_error_message (bool),
  is_interrogative (bool),
  retry_signal (bool)

messages_fts (FTS5 virtual table)
  content_text, session_id, message_id, timestamp
  -- contentless, populated via triggers on messages

tool_calls
  id (PK), session_id (FK), message_id (FK),
  tool_name, arguments_json, result_summary, timestamp

summaries
  id (PK), period (daily | weekly | per-project),
  date, project_path (nullable),
  content_md, model_used, generated_at

file_offsets
  session_file_path (PK), last_byte_read, last_processed_at
```

Notes:

- `project_name` is `path.basename(cwd)`, denormalized so the dashboard joins less.
- `content` is the raw JSON message; `content_text` is the rendered plain text we display and index.
- `messages_fts` is FTS5 with porter stemming. Triggers keep it in sync with `messages`.
- `tool_calls` are extracted from `assistant.message.content` blocks at parse time. Empty in the Weekend 1 slice; the table exists.
- `summaries.project_path` is nullable. Daily and weekly summaries leave it null. Per-project rollups set it. One table for all three.
- `ended_without_assistant_reply` is a bool we set when a session's last meaningful event is a user message. Cheap signal for "this session was interrupted."
- **Patterns features** are computed deterministically by the parser. `has_file_path` matches `/[\w./-]+\.[a-z]{1,5}\b/` plus a few path-shape heuristics; `has_code_block` matches triple-backtick fences; `has_error_message` matches common error prefixes (`Error:`, `TypeError:`, stack-trace shapes); `is_interrogative` is "ends in `?` and lacks an imperative verb in the first clause"; `retry_signal` matches a small phrase list (`no, not that`, `actually,`, `try again`, `that's wrong`, `no, do`). These are heuristics, not judgments. We surface counts, not scores.

## Dashboard surfaces

The dashboard has six surfaces in v1, each scaled to the editorial system locked during brainstorming.

### 1. Today (home, `/`)

The daily masthead. Composition:

- **Eyebrow** in mono caps with the date and a project-glyph mark.
- **Headline** in serif: today's most active session's `ai_title`, or the daily summary's headline once the summarizer is online. Falls back to "Quiet day" if no sessions today.
- **Italic deck** below the headline: one sentence of context, generated by the summarizer or computed (`3 sessions across 2 projects`).
- **Stat row**, demoted: messages, sessions, tokens (estimate). Three small numerals. Not the centerpiece.
- **Search bar** below the stats. Single input. Lives in the page header on every surface so it follows you. The most-clicked element on the page.
- **Today's projects ledger**: each row is a project with sessions today, messages today, and the day's `ai_title` summary. The ledger is the centerpiece.
- **Messages last 14 days** chart: thin Recharts line with the warm accent fill, sits at the bottom as ambient texture, not headline data.

### 2. Search (`/search?q=...`)

The recall surface.

- One input. Filters: project (multi-select), date range, role (user/assistant).
- Results are message snippets with the matched phrase highlighted, the session's `ai_title`, the project, and the relative timestamp.
- Click a result → session detail page, scrolled to and highlighting that message.
- Empty state shows recent sessions across all projects.

### 3. Projects (`/projects`)

The portfolio surface. Grid of project cards.

Each card shows:

- Project name (serif).
- Last touched (relative).
- Current focus, generated from the most recent 1-3 session summaries (Weekend 2 once summarizer is online; until then, the most recent session's `ai_title`).
- Open thread indicator if the most recent session has `ended_without_assistant_reply = true`.
- Tiny 14-day messages spark.
- Total sessions, total messages.

Sorted by last touched, descending. Stalled projects (no activity in 7+ days) get a subtle `Stalled` tag.

### 4. Project detail (`/projects/[slug]`)

A masthead for one project. Composition:

- Project name as headline.
- Italic deck: a one-sentence current focus.
- Timeline of recent sessions, each with `ai_title`, date, message count, and an excerpt of the first user message.
- Most-touched files (Weekend 2, derived from `tool_calls.arguments_json` for Edit/Write).
- Per-project weekly summary (Weekend 2).

### 5. Patterns (`/patterns`)

The third pillar. Retrospective view of how my prompting is changing. All metrics are deterministic, computed at parse time. No LLM scoring in v1.

Sections, in order:

- **Headline + deck**: a plain-English read of the period (`Your prompts are getting longer and more specific. 26% include a file path now, up from 11% two weeks ago.`). In v1 this is templated from the deltas. Weekend 2, the summarizer rewrites it as proper prose with the same numbers.
- **Prompt length, distributed**: histogram of user prompts over the last 14 days, accent band over the median, with three callouts (median word count, shortest-prompt count, share under 10 words).
- **Prompt anatomy**: six bars showing `% of prompts containing` each signal — file path, code block, error message, imperative, question with no context, multi-ask. Each shows current %, delta over 14 days, and a one-line outcome correlation pulled from the data ("prompts that mention a path get a 1-shot fix 71% of the time"). Outcomes are aggregated, not LLM-judged.
- **One-shot success**: % of sessions completed in ≤ 3 turns, trended over the period.
- **Where you redirect Claude**: top retry phrases by count, with sessions touched. Beside it, a coach-flavored insight box: italic prose, accent left rule, footer caveat (`Heuristic · derived · not a confident causal claim`).
- **Sessions that drifted**: clickable rows showing sessions flagged as likely doom loops. Flag heuristics: `DRIFT` (≥ 5 retry signals + repeated edits to same file), `VAGUE` (avg user-prompt length under 20 words and ≥ 4 turns), `SHIFTING` (≥ 4 `actually,` redirects). Click → session detail page.

The integrity contract for this surface: we count features, we don't score quality. The footer carries the line `All metrics derived from local data — no scoring by AI` so it never reads as fake authority.

### 6. Session detail (`/sessions/[id]`)

The reading view. Editorial first.

- Eyebrow: project name and date.
- Headline: `ai_title`.
- Body: the conversation rendered as alternating prose blocks. User messages serif, assistant messages serif at slightly smaller size in a softer ink. Tool calls as marginalia (right-rail callouts), labeled and collapsed by default.
- Sticky outline on the left listing each user prompt as a navigable anchor.
- Slipped into Weekend 2; in Weekend 1 the route exists and renders raw `content_text` only.

## Aesthetic system

Locked from brainstorming.

- **Type:** Iowan Old Style / Apple Garamond / Hoefler Text / Georgia stack for headlines and numerals. SF Mono / IBM Plex Mono for eyebrows, labels, and code. System sans for body text.
- **Palette:** paper `#f6f3ec`, ink `#1a1a1a`, dim `#8a7e63`, rule `rgba(26,26,26,0.18)`, accent `#c89b7b`, page background `#ddd6c7`.
- **Layout:** max-width 880px main column. Generous outer padding. Cream paper card on a soft tan workspace.
- **Charts:** thin 1.4px stroke, accent area fill at 18% opacity, hand-drawn baseline. No axis chrome beyond a one-pixel baseline.
- **Animation:** restrained. Cubic-bezier `(0.2, 0.7, 0.2, 1)` on most transitions. Page-enter staggered fade-up (40ms apart, 720ms each). Rule scales in left-to-right. Stat numerals count up over 900ms. Chart line draws on via stroke-dasharray. Today point breathes (2.4s loop). Live updates flash accent then settle. Sync dot breathes in the footer. `prefers-reduced-motion` skips the choreography.
- **Mark:** a small accent square + `TRACE / 001` mono caps, top right of every page.
- **Favicon:** the same accent square. Weekend 2.

## Vertical slice (Weekend 1)

The thinnest version that proves the round trip.

In:

- pnpm workspace scaffolded with the four packages.
- `packages/shared` with Zod schemas for the JSONL line types we care about.
- `packages/parser` with pure functions: `parseLine(jsonStr) → ParsedEvent | null`. Tested.
- `packages/db` with Drizzle schema, the migration, the FTS5 trigger setup, the SQLite path constant.
- `apps/watcher`: chokidar watcher, offset tracking, idempotent inserts.
- `apps/dashboard`: home (editorial masthead, project ledger, demoted stat row, demoted chart, search input), `/search` results page, `/projects` portfolio page, `/projects/[slug]` project detail (timeline only), `/patterns` (length distribution, prompt anatomy, one-shot rate, retry phrases, drift list — all deterministic), `/sessions/[id]` (raw text only).
- Editorial type, palette, and entrance animation applied across all surfaces.
- Tool call rows: parser extracts them, watcher writes them. Surface comes Weekend 2.
- Patterns features: parser computes per-message booleans (`has_file_path`, `has_code_block`, `has_error_message`, `is_interrogative`, `retry_signal`, `word_count`); watcher updates per-session aggregates (`turn_count`, `assistant_question_count`, `first_response_was_tool`, `retry_signal_count`) when a session closes (or rolls forward on each insert).

Out (Weekend 2 or later):

- Summarizer (`apps/summarizer`).
- launchd agent.
- Most-touched files on project detail.
- Reading-view session detail (marginalia, prose blocks).
- Per-project weekly summary.
- Files most touched, top tools, time-of-day heatmap, streak.
- Coach view (v2).

### Definition of done for the slice

I run `pnpm dev` in two panes (watcher + dashboard) and use Claude Code in a third window. Within seconds, my localhost dashboard updates: today's masthead reflects today's most active session, the project ledger lists my real projects, the search bar finds a phrase I just typed in another window, the projects page shows every active project with a real "last touched" timestamp, and `/patterns` shows real distributions and a real one-shot rate computed from my actual prompts (not seeded data).

## Future considerations

- **Coach view (v2).** Real-time and per-session LLM-judged quality scoring. "First 50 minutes productive, last 40 in a doom loop." Personalized advice grounded in your specific patterns over a month of v1 use. The hardest, headiest version of Trace and the one that earns a real product moat. Held until v1 has been used daily for a month and we know which deterministic signals carry weight.
- **Cost surfacing.** Once the Anthropic API exposes per-session cost cleanly, surface dollars on the project portfolio, the weekly summary, and the Patterns page.
- **Skill / hook attribution.** Which superpowers skills loaded into a session, did they help, and how often. Useful but speculative until v1 ships.
- **Session-as-story polish.** The full marginalia treatment with sticky outline, prompt-anchor navigation, and tool-call drill-down.
- **Time-of-day heatmap.** Lives on Patterns once we know if the rhythm signal is interesting.
- **Patterns LLM narrative.** Weekend 2: summarizer rewrites the Patterns page headline and deck as proper prose using the same numbers, with an explicit AI-generated label.

## Open questions

None block Weekend 1. Flagged for later:

- Whether to drop the demoted stat row from the home page entirely once summaries land. Probably yes.
- Whether project detail should be one page or split into "current state" and "timeline."
- Whether `summaries.period` should be an enum or a string. Drizzle is fine either way.

## Risks

- **JSONL format changes silently.** Mitigation: parser is pure-functional and unit-tested against fixtures captured today. New unknown line types log and drop, never crash.
- **FTS5 + Drizzle ergonomics.** Drizzle doesn't have first-class FTS5 helpers. Mitigation: write the FTS5 setup in raw SQL inside the migration, query through Drizzle's `sql\`...\`` helper.
- **`content_text` rendering loses fidelity.** Code blocks, attachments, and embedded JSON. Mitigation: render is best-effort for v1, and `content` raw JSON is always available for the session detail view's eventual marginalia treatment.
- **Patterns heuristics give false confidence.** A 71% one-shot rate sounds rigorous when it's actually counting cheap features. Mitigation: surface raw counts alongside percentages, label outcome correlations as heuristics, footer the page with `All metrics derived from local data — no scoring by AI`, never rank prompts as good or bad. The Patterns page is read-only data; advice waits for v2.

## Decisions captured

- Vertical slice over foundation-first or data-first.
- Editorial aesthetic over terminal, brutalist, or soft-minimal.
- Three pillars in v1: Recall (search + session detail), Portfolio (today + projects), Patterns (deterministic features).
- LLM-judged quality scoring deferred to v2. v1 Patterns counts features, doesn't score.
- One repo, one machine, one user. No deploy.
- Charts demoted from centerpiece on every surface.
