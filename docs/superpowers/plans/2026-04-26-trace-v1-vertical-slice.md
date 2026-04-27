# Trace v1 Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Weekend 1 vertical slice of Trace: a watcher that tails `~/.claude/projects/` into SQLite, and a Next.js dashboard with six routes (Today, Search, Projects, Project detail, Patterns, Session detail) rendered in the locked editorial aesthetic.

**Architecture:** pnpm workspaces, two long-running processes (`watcher`, `dashboard`) sharing four packages (`shared`, `parser`, `db`, plus a small dashboard `lib`). Watcher: chokidar + offset tracking + idempotent inserts. Dashboard: Next.js 15 App Router server components reading SQLite directly via Drizzle, no API layer. FTS5 virtual table for full-text search. Patterns features computed at parse time.

**Tech Stack:** Node.js 22 LTS, TypeScript strict, pnpm workspaces, vitest, Zod, better-sqlite3, Drizzle ORM, chokidar, Next.js 15, Tailwind CSS, Recharts (used minimally), `concurrently` for dev orchestration.

**Spec:** [`docs/superpowers/specs/2026-04-26-trace-design.md`](../specs/2026-04-26-trace-design.md). When in doubt, the spec is canonical. This plan implements the vertical-slice section of the spec only; Weekend 2 work (summarizer, launchd agent, session reading view, etc.) is deliberately deferred.

**Working agreement (from CLAUDE.md):** TypeScript strict, no `any`. Functional style by default. Named exports. kebab-case file names, PascalCase only for React components. Files >200 lines usually want splitting. No em dashes in any prose written. Commit and push at coherent checkpoints with conventional commit prefixes.

---

## File structure (locked)

Each file owns one responsibility. Files that change together live together.

```
trace/
  package.json                         workspace root, pnpm scripts
  pnpm-workspace.yaml
  tsconfig.base.json                   strict shared base
  vitest.config.ts                     workspace vitest config
  .prettierrc.json
  .nvmrc                               node 22

  packages/
    shared/
      package.json
      tsconfig.json
      src/
        paths.ts                       CLAUDE_PROJECTS_DIR, TRACE_HOME, TRACE_DB_PATH
        schemas.ts                     Zod schemas for JSONL line shapes
        types.ts                       inferred types + ParsedEvent union
        index.ts                       re-exports

    parser/
      package.json
      tsconfig.json
      src/
        parse-line.ts                  parseLine(json: string) → ParsedEvent | null
        extract-text.ts                content blocks → plain text
        extract-tool-calls.ts          assistant.message.content → ToolCall[]
        features.ts                    deterministic prompt-feature computation
        retry-phrases.ts               regex list for retry_signal detection
        index.ts                       re-exports
      test/
        fixtures/                      real JSONL lines captured for tests
          user-line.json
          assistant-line.json
          assistant-with-tool.json
          ai-title.json
          attachment.json
          queue-operation.json
        parse-line.test.ts
        features.test.ts
        extract-text.test.ts
        extract-tool-calls.test.ts

    db/
      package.json
      tsconfig.json
      src/
        schema.ts                      Drizzle schema for all tables
        client.ts                      better-sqlite3 + Drizzle wrapper
        migrate.ts                     applies init.sql, idempotent
        migrations/
          0000_init.sql                tables + FTS5 virtual + triggers
        queries/
          today.ts
          projects.ts
          project-detail.ts
          search.ts
          patterns.ts
          session-detail.ts
        index.ts                       re-exports
      test/
        queries.test.ts                in-memory db, seeded rows

  apps/
    watcher/
      package.json
      tsconfig.json
      src/
        index.ts                       entry point: start watcher
        watch.ts                       chokidar wiring
        process-file.ts                read from offset, parse, insert
        inserts.ts                     db inserts + per-session aggregates
      test/
        process-file.test.ts           integration: temp dir + fixture file

    dashboard/
      package.json
      tsconfig.json
      next.config.mjs
      tailwind.config.ts
      postcss.config.mjs
      src/
        app/
          layout.tsx                   root layout, fonts, header, search bar
          globals.css                  theme tokens + animation keyframes
          page.tsx                     Today (/)
          search/page.tsx              Search (/search)
          projects/page.tsx            Portfolio (/projects)
          projects/[slug]/page.tsx     Project detail
          patterns/page.tsx            Patterns
          sessions/[id]/page.tsx       Session detail (raw text in v1)
        components/
          AppHeader.tsx                persistent header
          Masthead.tsx                 eyebrow + headline + deck
          ProjectRow.tsx               ledger row
          Sparkline.tsx                tiny SVG spark
          AmbientChart.tsx             14-day messages line at home bottom
          PatternBar.tsx               anatomy bar
          LengthHistogram.tsx          patterns length distribution
          DriftRow.tsx                 patterns sessions-drifted row
          Pill.tsx                     small status pill
          Reveal.tsx                   client-side staggered fade-up
        lib/
          format.ts                    relative-time, humanize numbers
          patterns-derived.ts          summary text from deltas
```

---

## Task index

- **Phase A — Workspace and tooling**
  - Task 1: Initialize pnpm workspace and root configs
  - Task 2: Configure root tsconfig, prettier, vitest
  - Task 3: Scaffold `packages/shared` with paths + Zod schemas
- **Phase B — Parser**
  - Task 4: Capture JSONL fixtures from real data
  - Task 5: `parseLine` handles user and assistant lines
  - Task 6: `parseLine` handles `ai-title`, `attachment`, drops noise
  - Task 7: `extractText` flattens content blocks
  - Task 8: `extractToolCalls` from assistant content
  - Task 9: `features` (word count + binary signals)
  - Task 10: `retry-phrases` regex list
- **Phase C — Database**
  - Task 11: Drizzle schema for all six tables
  - Task 12: Initial SQL migration with FTS5 + triggers
  - Task 13: Client + migrate
  - Task 14: Query helpers per surface
- **Phase D — Watcher**
  - Task 15: `apps/watcher` skeleton + entry
  - Task 16: `process-file` and `inserts` (offset-tracked, idempotent)
  - Task 17: Integration test against a temp directory
- **Phase E — Dashboard scaffolding**
  - Task 18: Next.js 15 init + Tailwind
  - Task 19: Editorial theme tokens, fonts, animation keyframes
  - Task 20: `AppHeader`, `Reveal`, `Masthead`, `Sparkline`, `Pill`
- **Phase F — Routes**
  - Task 21: Today (/)
  - Task 22: Search (/search)
  - Task 23: Projects (/projects)
  - Task 24: Project detail (/projects/[slug])
  - Task 25: Patterns (/patterns)
  - Task 26: Session detail (/sessions/[id])
- **Phase G — Wiring**
  - Task 27: Top-level `pnpm dev` runs watcher + dashboard concurrently
  - Task 28: Smoke run against real data + README polish

---

## Phase A — Workspace and tooling

### Task 1: Initialize pnpm workspace and root configs

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.nvmrc`
- Modify: `.gitignore` (already has `node_modules`, confirm)

- [ ] **Step 1: Confirm Node 22 is available**

Run: `node -v`
Expected: `v22.x.x` or higher. If not, install Node 22 LTS first.

- [ ] **Step 2: Confirm pnpm is available**

Run: `pnpm -v`
Expected: `9.x` or higher. If missing: `corepack enable && corepack prepare pnpm@latest --activate`.

- [ ] **Step 3: Create `.nvmrc`**

```
22
```

- [ ] **Step 4: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 5: Create root `package.json`**

```json
{
  "name": "trace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "concurrently -n watcher,dashboard -c yellow,cyan \"pnpm --filter @trace/watcher dev\" \"pnpm --filter @trace/dashboard dev\"",
    "build": "pnpm -r build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "pnpm -r typecheck",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "prettier": "^3.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 6: Install root deps**

Run: `pnpm install`
Expected: Lockfile created, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .nvmrc
git commit -m "chore: initialize pnpm workspace"
git push
```

### Task 2: Configure root tsconfig, prettier, vitest

**Files:**
- Create: `tsconfig.base.json`
- Create: `.prettierrc.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": ["**/node_modules", "**/dist", "**/.next"]
}
```

- [ ] **Step 2: Create `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
    environment: 'node',
    globals: false,
    reporters: 'default',
  },
});
```

- [ ] **Step 4: Sanity-check vitest discovery**

Run: `pnpm test`
Expected: "No test files found." Exit code 0 or 1, that's fine — no tests yet.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.base.json .prettierrc.json vitest.config.ts
git commit -m "chore: add typescript, prettier, vitest configs"
git push
```

### Task 3: Scaffold `packages/shared` with paths + Zod schemas

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/paths.ts`
- Create: `packages/shared/src/schemas.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@trace/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/shared/src/paths.ts`**

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';

export const HOME = homedir();
export const CLAUDE_PROJECTS_DIR = join(HOME, '.claude', 'projects');
export const TRACE_HOME = join(HOME, 'Trace');
export const TRACE_DB_PATH = join(TRACE_HOME, 'trace.db');
export const TRACE_SUMMARIES_DIR = join(TRACE_HOME, 'summaries');
```

- [ ] **Step 4: Create `packages/shared/src/schemas.ts`**

These are intentionally permissive — Claude Code adds fields over time. Strict checks happen on the fields we read.

```ts
import { z } from 'zod';

const ContentBlock = z.union([
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.unknown().optional(),
    is_error: z.boolean().optional(),
  }),
  z.object({ type: z.string() }).passthrough(),
]);

const Message = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.union([z.string(), z.array(ContentBlock)]),
  })
  .passthrough();

export const UserLineSchema = z
  .object({
    type: z.literal('user'),
    sessionId: z.string(),
    timestamp: z.string(),
    uuid: z.string(),
    parentUuid: z.string().nullable().optional(),
    cwd: z.string().optional(),
    gitBranch: z.string().nullable().optional(),
    message: Message,
  })
  .passthrough();

export const AssistantLineSchema = z
  .object({
    type: z.literal('assistant'),
    sessionId: z.string(),
    timestamp: z.string(),
    uuid: z.string(),
    parentUuid: z.string().nullable().optional(),
    cwd: z.string().optional(),
    gitBranch: z.string().nullable().optional(),
    message: Message,
  })
  .passthrough();

export const AiTitleLineSchema = z
  .object({
    type: z.literal('ai-title'),
    sessionId: z.string(),
    aiTitle: z.string(),
  })
  .passthrough();

export const AttachmentLineSchema = z
  .object({
    type: z.literal('attachment'),
    sessionId: z.string(),
    timestamp: z.string().optional(),
  })
  .passthrough();

export const NoiseLineSchema = z
  .object({
    type: z.enum(['queue-operation', 'file-history-snapshot', 'last-prompt']),
  })
  .passthrough();

export const AnyLineSchema = z.union([
  UserLineSchema,
  AssistantLineSchema,
  AiTitleLineSchema,
  AttachmentLineSchema,
  NoiseLineSchema,
]);
```

- [ ] **Step 5: Create `packages/shared/src/types.ts`**

```ts
import type { z } from 'zod';
import type {
  UserLineSchema,
  AssistantLineSchema,
  AiTitleLineSchema,
  AttachmentLineSchema,
  NoiseLineSchema,
} from './schemas.js';

export type UserLine = z.infer<typeof UserLineSchema>;
export type AssistantLine = z.infer<typeof AssistantLineSchema>;
export type AiTitleLine = z.infer<typeof AiTitleLineSchema>;
export type AttachmentLine = z.infer<typeof AttachmentLineSchema>;
export type NoiseLine = z.infer<typeof NoiseLineSchema>;

export type Role = 'user' | 'assistant';

export interface PromptFeatures {
  word_count: number;
  has_file_path: boolean;
  has_code_block: boolean;
  has_error_message: boolean;
  is_interrogative: boolean;
  retry_signal: boolean;
}

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments_json: string;
}

export type ParsedEvent =
  | {
      kind: 'message';
      sessionId: string;
      uuid: string;
      role: Role;
      timestamp: string;
      cwd: string | undefined;
      gitBranch: string | null | undefined;
      contentRaw: unknown;
      contentText: string;
      tokenCountEstimate: number;
      features: PromptFeatures;
      toolCalls: ParsedToolCall[];
    }
  | { kind: 'ai-title'; sessionId: string; aiTitle: string }
  | { kind: 'noise' };
```

- [ ] **Step 6: Create `packages/shared/src/index.ts`**

```ts
export * from './paths.js';
export * from './schemas.js';
export * from './types.js';
```

- [ ] **Step 7: Install + typecheck**

Run: `pnpm install`
Run: `pnpm --filter @trace/shared typecheck`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/ pnpm-lock.yaml
git commit -m "feat(shared): add paths and zod schemas for jsonl lines"
git push
```

---

## Phase B — Parser

### Task 4: Capture JSONL fixtures from real data

**Files:**
- Create: `packages/parser/package.json`
- Create: `packages/parser/tsconfig.json`
- Create: `packages/parser/test/fixtures/user-line.json`
- Create: `packages/parser/test/fixtures/assistant-line.json`
- Create: `packages/parser/test/fixtures/assistant-with-tool.json`
- Create: `packages/parser/test/fixtures/ai-title.json`
- Create: `packages/parser/test/fixtures/attachment.json`
- Create: `packages/parser/test/fixtures/queue-operation.json`

- [ ] **Step 1: Create `packages/parser/package.json`**

```json
{
  "name": "@trace/parser",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@trace/shared": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/parser/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "noEmit": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Capture one of each line type from a real session**

Pick a real JSONL file under `~/.claude/projects/-Users-bryce-Personal-projects-trace/`. Open it, find one line per type, and save each as its own pretty-printed `*.json` file under `packages/parser/test/fixtures/`. Strip secrets and any obviously private text (replace prompt content with short representative strings if needed). The shape must remain identical — only string values change.

Example shapes the engineer should ensure are present:

`user-line.json`:

```json
{
  "type": "user",
  "sessionId": "00000000-0000-0000-0000-000000000001",
  "timestamp": "2026-04-26T12:00:00.000Z",
  "uuid": "11111111-1111-1111-1111-111111111111",
  "parentUuid": null,
  "cwd": "/Users/example/Personal/projects/trace",
  "gitBranch": "main",
  "message": {
    "role": "user",
    "content": "Update src/parser.ts to handle null timestamps. Here is the failing test output:\n```\nError: cannot read properties of null\n```"
  }
}
```

`assistant-line.json`:

```json
{
  "type": "assistant",
  "sessionId": "00000000-0000-0000-0000-000000000001",
  "timestamp": "2026-04-26T12:00:01.000Z",
  "uuid": "22222222-2222-2222-2222-222222222222",
  "parentUuid": "11111111-1111-1111-1111-111111111111",
  "cwd": "/Users/example/Personal/projects/trace",
  "gitBranch": "main",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "Got it. Let me read the file." }
    ]
  }
}
```

`assistant-with-tool.json`:

```json
{
  "type": "assistant",
  "sessionId": "00000000-0000-0000-0000-000000000001",
  "timestamp": "2026-04-26T12:00:02.000Z",
  "uuid": "33333333-3333-3333-3333-333333333333",
  "parentUuid": "22222222-2222-2222-2222-222222222222",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "Reading now." },
      {
        "type": "tool_use",
        "id": "toolu_abc",
        "name": "Read",
        "input": { "file_path": "/Users/example/Personal/projects/trace/src/parser.ts" }
      }
    ]
  }
}
```

`ai-title.json`:

```json
{ "type": "ai-title", "sessionId": "00000000-0000-0000-0000-000000000001", "aiTitle": "Fix null timestamp parsing" }
```

`attachment.json`:

```json
{
  "type": "attachment",
  "sessionId": "00000000-0000-0000-0000-000000000001",
  "attachment": { "type": "hook_success", "hookName": "SessionStart" }
}
```

`queue-operation.json`:

```json
{
  "type": "queue-operation",
  "operation": "enqueue",
  "sessionId": "00000000-0000-0000-0000-000000000001",
  "timestamp": "2026-04-26T12:00:00.000Z"
}
```

- [ ] **Step 4: Install + typecheck the empty package**

Run: `pnpm install`
Run: `pnpm --filter @trace/parser typecheck`
Expected: No errors (no source yet, that's fine).

- [ ] **Step 5: Commit**

```bash
git add packages/parser/ pnpm-lock.yaml
git commit -m "test(parser): capture jsonl line fixtures"
git push
```

### Task 5: `parseLine` handles user and assistant lines

**Files:**
- Create: `packages/parser/src/parse-line.ts`
- Create: `packages/parser/src/extract-text.ts` (stub)
- Create: `packages/parser/src/extract-tool-calls.ts` (stub)
- Create: `packages/parser/src/features.ts` (stub)
- Create: `packages/parser/src/index.ts`
- Create: `packages/parser/test/parse-line.test.ts`

The strategy: build the structure with stubbed sub-functions, write the user/assistant test, watch it fail in the right way, implement enough to pass.

- [ ] **Step 1: Create stubs for the helper modules so imports compile**

`packages/parser/src/extract-text.ts`:

```ts
export function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block && typeof block === 'object' && 'type' in block) {
        const b = block as { type: string; text?: string };
        if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text);
      }
    }
    return parts.join('\n\n');
  }
  return '';
}
```

`packages/parser/src/extract-tool-calls.ts`:

```ts
import type { ParsedToolCall } from '@trace/shared';

export function extractToolCalls(content: unknown): ParsedToolCall[] {
  if (!Array.isArray(content)) return [];
  const calls: ParsedToolCall[] = [];
  for (const block of content) {
    if (block && typeof block === 'object' && 'type' in block) {
      const b = block as { type: string; id?: string; name?: string; input?: unknown };
      if (b.type === 'tool_use' && b.id && b.name) {
        calls.push({ id: b.id, name: b.name, arguments_json: JSON.stringify(b.input ?? {}) });
      }
    }
  }
  return calls;
}
```

`packages/parser/src/features.ts`:

```ts
import type { PromptFeatures } from '@trace/shared';

export function computeFeatures(text: string, role: 'user' | 'assistant'): PromptFeatures {
  // Stub: empty signals. Real implementation in Task 9.
  return {
    word_count: text.trim() === '' ? 0 : text.trim().split(/\s+/u).length,
    has_file_path: false,
    has_code_block: false,
    has_error_message: false,
    is_interrogative: false,
    retry_signal: false,
  };
  void role;
}
```

- [ ] **Step 2: Create `packages/parser/src/parse-line.ts`**

```ts
import { AnyLineSchema } from '@trace/shared';
import type { ParsedEvent } from '@trace/shared';
import { extractText } from './extract-text.js';
import { extractToolCalls } from './extract-tool-calls.js';
import { computeFeatures } from './features.js';

export function parseLine(json: string): ParsedEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }

  const result = AnyLineSchema.safeParse(raw);
  if (!result.success) return null;
  const line = result.data;

  switch (line.type) {
    case 'user':
    case 'assistant': {
      const role = line.message.role;
      const contentText = extractText(line.message.content);
      const tokenCountEstimate = Math.ceil(contentText.length / 4);
      return {
        kind: 'message',
        sessionId: line.sessionId,
        uuid: line.uuid,
        role,
        timestamp: line.timestamp,
        cwd: line.cwd,
        gitBranch: line.gitBranch,
        contentRaw: line.message.content,
        contentText,
        tokenCountEstimate,
        features: computeFeatures(contentText, role),
        toolCalls: role === 'assistant' ? extractToolCalls(line.message.content) : [],
      };
    }
    case 'ai-title':
      return { kind: 'ai-title', sessionId: line.sessionId, aiTitle: line.aiTitle };
    default:
      return { kind: 'noise' };
  }
}
```

- [ ] **Step 3: Create `packages/parser/src/index.ts`**

```ts
export { parseLine } from './parse-line.js';
export { extractText } from './extract-text.js';
export { extractToolCalls } from './extract-tool-calls.js';
export { computeFeatures } from './features.js';
```

- [ ] **Step 4: Write the failing test for user and assistant lines**

`packages/parser/test/parse-line.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLine } from '../src/parse-line.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf8');

describe('parseLine', () => {
  it('parses a user line', () => {
    const event = parseLine(fixture('user-line.json'));
    expect(event).not.toBeNull();
    if (!event || event.kind !== 'message') throw new Error('expected message');
    expect(event.role).toBe('user');
    expect(event.sessionId).toBe('00000000-0000-0000-0000-000000000001');
    expect(event.contentText).toContain('null timestamps');
    expect(event.toolCalls).toHaveLength(0);
  });

  it('parses an assistant line', () => {
    const event = parseLine(fixture('assistant-line.json'));
    if (!event || event.kind !== 'message') throw new Error('expected message');
    expect(event.role).toBe('assistant');
    expect(event.contentText).toBe('Got it. Let me read the file.');
  });

  it('returns null for invalid JSON', () => {
    expect(parseLine('not json')).toBeNull();
  });
});
```

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm vitest run packages/parser/test/parse-line.test.ts`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add packages/parser/src/ packages/parser/test/parse-line.test.ts
git commit -m "feat(parser): parseLine for user and assistant"
git push
```

### Task 6: `parseLine` handles `ai-title`, `attachment`, drops noise

**Files:**
- Modify: `packages/parser/test/parse-line.test.ts`

- [ ] **Step 1: Add tests for the remaining line types**

Append to `packages/parser/test/parse-line.test.ts`:

```ts
describe('parseLine — non-message line types', () => {
  it('extracts ai-title', () => {
    const event = parseLine(fixture('ai-title.json'));
    if (!event || event.kind !== 'ai-title') throw new Error('expected ai-title');
    expect(event.aiTitle).toBe('Fix null timestamp parsing');
    expect(event.sessionId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('classifies attachment as noise (v1)', () => {
    const event = parseLine(fixture('attachment.json'));
    if (!event) throw new Error('expected event');
    expect(event.kind).toBe('noise');
  });

  it('classifies queue-operation as noise', () => {
    const event = parseLine(fixture('queue-operation.json'));
    if (!event) throw new Error('expected event');
    expect(event.kind).toBe('noise');
  });

  it('returns null for an unknown line shape', () => {
    expect(parseLine(JSON.stringify({ totally: 'unknown' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests, expect pass**

Run: `pnpm vitest run packages/parser/test/parse-line.test.ts`
Expected: 7 passing. Attachment falls through to the default branch in `parseLine` returning `{ kind: 'noise' }` because it isn't a `user`/`assistant`/`ai-title` line.

- [ ] **Step 3: Commit**

```bash
git add packages/parser/test/parse-line.test.ts
git commit -m "test(parser): cover ai-title, attachment, noise, unknown"
git push
```

### Task 7: `extractText` flattens content blocks

**Files:**
- Modify: `packages/parser/src/extract-text.ts`
- Create: `packages/parser/test/extract-text.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { extractText } from '../src/extract-text.js';

describe('extractText', () => {
  it('returns string content as-is', () => {
    expect(extractText('hello world')).toBe('hello world');
  });

  it('joins text blocks with two newlines', () => {
    const result = extractText([
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ]);
    expect(result).toBe('first\n\nsecond');
  });

  it('summarizes tool_use blocks inline', () => {
    const result = extractText([
      { type: 'text', text: 'reading file' },
      { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a/b.ts' } },
    ]);
    expect(result).toContain('reading file');
    expect(result).toContain('[tool: Read]');
  });

  it('summarizes tool_result blocks inline', () => {
    const result = extractText([
      { type: 'tool_result', tool_use_id: 't1', content: 'file contents' },
    ]);
    expect(result).toContain('[tool result]');
  });

  it('returns empty string for unknown shapes', () => {
    expect(extractText(123)).toBe('');
    expect(extractText(null)).toBe('');
    expect(extractText(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run, expect failures on tool_use and tool_result**

Run: `pnpm vitest run packages/parser/test/extract-text.test.ts`
Expected: 2 fail (tool_use, tool_result), 3 pass.

- [ ] **Step 3: Replace `packages/parser/src/extract-text.ts` with full implementation**

```ts
type Block = { type: string; text?: string; name?: string; [key: string]: unknown };

export function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object' || !('type' in block)) continue;
    const b = block as Block;

    switch (b.type) {
      case 'text':
        if (typeof b.text === 'string') parts.push(b.text);
        break;
      case 'tool_use':
        parts.push(`[tool: ${typeof b.name === 'string' ? b.name : 'unknown'}]`);
        break;
      case 'tool_result':
        parts.push('[tool result]');
        break;
      default:
        break;
    }
  }
  return parts.join('\n\n');
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm vitest run packages/parser/test/extract-text.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/parser/src/extract-text.ts packages/parser/test/extract-text.test.ts
git commit -m "feat(parser): extractText handles tool_use and tool_result blocks"
git push
```

### Task 8: `extractToolCalls` from assistant content

**Files:**
- Modify: `packages/parser/src/extract-tool-calls.ts`
- Create: `packages/parser/test/extract-tool-calls.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { extractToolCalls } from '../src/extract-tool-calls.js';

describe('extractToolCalls', () => {
  it('returns empty for string content', () => {
    expect(extractToolCalls('text only')).toEqual([]);
  });

  it('returns empty when no tool_use blocks', () => {
    expect(extractToolCalls([{ type: 'text', text: 'hi' }])).toEqual([]);
  });

  it('extracts a single tool_use', () => {
    const calls = extractToolCalls([
      { type: 'text', text: 'reading' },
      { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: '/a.ts' } },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.id).toBe('toolu_1');
    expect(calls[0]?.name).toBe('Read');
    expect(JSON.parse(calls[0]?.arguments_json ?? '{}')).toEqual({ file_path: '/a.ts' });
  });

  it('preserves order across multiple tool_use blocks', () => {
    const calls = extractToolCalls([
      { type: 'tool_use', id: 'a', name: 'Bash', input: { command: 'ls' } },
      { type: 'text', text: 'and now' },
      { type: 'tool_use', id: 'b', name: 'Edit', input: { path: '/x' } },
    ]);
    expect(calls.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run, expect pass (existing stub already handles this)**

Run: `pnpm vitest run packages/parser/test/extract-tool-calls.test.ts`
Expected: 4 passing.

- [ ] **Step 3: Commit**

```bash
git add packages/parser/test/extract-tool-calls.test.ts
git commit -m "test(parser): cover extractToolCalls"
git push
```

### Task 9: `features` (word count + binary signals)

**Files:**
- Create: `packages/parser/src/retry-phrases.ts`
- Modify: `packages/parser/src/features.ts`
- Create: `packages/parser/test/features.test.ts`

The retry list is small on purpose — false positives are worse than false negatives.

- [ ] **Step 1: Create `packages/parser/src/retry-phrases.ts`**

```ts
export const RETRY_PHRASE_PATTERNS: RegExp[] = [
  /\bno,?\s+not\s+that\b/iu,
  /^\s*actually,?\s/iu,
  /\btry\s+again\b/iu,
  /\bthat'?s\s+wrong\b/iu,
  /\bnot\s+what\s+i\s+(?:asked|wanted|meant)\b/iu,
  /\bno,?\s+do\b/iu,
];

export function matchesRetry(text: string): boolean {
  for (const re of RETRY_PHRASE_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}
```

- [ ] **Step 2: Replace `packages/parser/src/features.ts` with full implementation**

```ts
import type { PromptFeatures } from '@trace/shared';
import { matchesRetry } from './retry-phrases.js';

const FILE_PATH_RE = /(?:^|[\s(`'"])(?:[a-zA-Z]:)?(?:\/|\.\/|[\w.-]+\/)[\w./-]+\.[a-zA-Z]{1,6}\b/u;
const CODE_BLOCK_RE = /```/u;
const ERROR_RE =
  /\b(?:Error|TypeError|ReferenceError|SyntaxError|RangeError|UnhandledPromiseRejection|Traceback|stack trace)\b/u;
const QUESTION_END_RE = /\?\s*$/u;
const IMPERATIVE_OPENERS_RE =
  /^\s*(?:add|fix|update|create|delete|remove|refactor|implement|write|change|move|rename|build|run|install|set|make|use|stop|start|generate|commit|push|merge|revert|investigate|review)\b/iu;

export function computeFeatures(text: string, role: 'user' | 'assistant'): PromptFeatures {
  const trimmed = text.trim();
  const word_count = trimmed === '' ? 0 : trimmed.split(/\s+/u).length;

  const features: PromptFeatures = {
    word_count,
    has_file_path: FILE_PATH_RE.test(text),
    has_code_block: CODE_BLOCK_RE.test(text),
    has_error_message: ERROR_RE.test(text),
    is_interrogative: false,
    retry_signal: false,
  };

  if (role !== 'user') return features;

  features.is_interrogative = QUESTION_END_RE.test(trimmed) && !IMPERATIVE_OPENERS_RE.test(trimmed);
  features.retry_signal = matchesRetry(trimmed);
  return features;
}
```

- [ ] **Step 3: Update `packages/parser/src/index.ts` to export the new module**

```ts
export { parseLine } from './parse-line.js';
export { extractText } from './extract-text.js';
export { extractToolCalls } from './extract-tool-calls.js';
export { computeFeatures } from './features.js';
export { matchesRetry, RETRY_PHRASE_PATTERNS } from './retry-phrases.js';
```

- [ ] **Step 4: Write tests**

`packages/parser/test/features.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../src/features.js';

const f = (text: string) => computeFeatures(text, 'user');

describe('computeFeatures (user)', () => {
  it('counts words', () => {
    expect(f('  fix   the  thing  ').word_count).toBe(3);
    expect(f('').word_count).toBe(0);
  });

  it('detects a file path', () => {
    expect(f('Update src/parser.ts please').has_file_path).toBe(true);
    expect(f('refactor /Users/me/projects/trace/src/index.ts').has_file_path).toBe(true);
  });

  it('does not flag bare words as file paths', () => {
    expect(f('refactor the parser').has_file_path).toBe(false);
  });

  it('detects code blocks', () => {
    expect(f('here:\n```\ncode\n```').has_code_block).toBe(true);
    expect(f('inline `code` only').has_code_block).toBe(false);
  });

  it('detects error messages', () => {
    expect(f('I am seeing TypeError: cannot read').has_error_message).toBe(true);
    expect(f('the test failed with an Error: bad thing').has_error_message).toBe(true);
    expect(f('please refactor').has_error_message).toBe(false);
  });

  it('marks questions, but not imperatives ending in ?', () => {
    expect(f('what should we do here?').is_interrogative).toBe(true);
    expect(f('fix the bug?').is_interrogative).toBe(false);
    expect(f('refactor this please').is_interrogative).toBe(false);
  });

  it('flags retry signals', () => {
    expect(f("no, not that — try the other one").retry_signal).toBe(true);
    expect(f('Actually, do it the other way').retry_signal).toBe(true);
    expect(f("that's wrong, undo it").retry_signal).toBe(true);
    expect(f('looks good, ship it').retry_signal).toBe(false);
  });
});

describe('computeFeatures (assistant)', () => {
  it('does not flag retry or interrogative for assistant messages', () => {
    const a = computeFeatures("That's wrong, undo it.", 'assistant');
    expect(a.retry_signal).toBe(false);
    expect(a.is_interrogative).toBe(false);
  });

  it('still counts words and code blocks for assistant', () => {
    const a = computeFeatures('Here is the code:\n```ts\nconst x = 1;\n```', 'assistant');
    expect(a.word_count).toBeGreaterThan(0);
    expect(a.has_code_block).toBe(true);
  });
});
```

- [ ] **Step 5: Run all parser tests**

Run: `pnpm vitest run packages/parser/`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add packages/parser/src/features.ts packages/parser/src/retry-phrases.ts packages/parser/src/index.ts packages/parser/test/features.test.ts
git commit -m "feat(parser): deterministic prompt features"
git push
```

### Task 10: parser final sweep — re-run parseLine end-to-end with features wired

**Files:**
- Modify: `packages/parser/test/parse-line.test.ts`

- [ ] **Step 1: Add a test that confirms features flow through `parseLine`**

Append to the file:

```ts
describe('parseLine — features wiring', () => {
  it('user line with a file path and code block has matching features', () => {
    const event = parseLine(fixture('user-line.json'));
    if (!event || event.kind !== 'message') throw new Error('expected message');
    expect(event.features.has_file_path).toBe(true);
    expect(event.features.has_code_block).toBe(true);
    expect(event.features.has_error_message).toBe(true);
    expect(event.features.word_count).toBeGreaterThan(5);
  });

  it('assistant line with a tool_use yields one tool call', () => {
    const event = parseLine(fixture('assistant-with-tool.json'));
    if (!event || event.kind !== 'message') throw new Error('expected message');
    expect(event.toolCalls).toHaveLength(1);
    expect(event.toolCalls[0]?.name).toBe('Read');
  });
});
```

- [ ] **Step 2: Run all parser tests**

Run: `pnpm vitest run packages/parser/`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add packages/parser/test/parse-line.test.ts
git commit -m "test(parser): end-to-end features and tool calls through parseLine"
git push
```

---

## Phase C — Database

### Task 11: Drizzle schema for all six tables

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@trace/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@trace/shared": "workspace:*",
    "better-sqlite3": "^11.3.0",
    "drizzle-orm": "^0.36.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Install deps**

Run: `pnpm install`

- [ ] **Step 4: Create `packages/db/src/schema.ts`**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  cwd: text('cwd').notNull(),
  project_name: text('project_name').notNull(),
  git_branch: text('git_branch'),
  ai_title: text('ai_title'),
  first_user_message: text('first_user_message'),
  started_at: text('started_at').notNull(),
  ended_at: text('ended_at').notNull(),
  message_count: integer('message_count').notNull().default(0),
  turn_count: integer('turn_count').notNull().default(0),
  tool_call_count: integer('tool_call_count').notNull().default(0),
  ended_without_assistant_reply: integer('ended_without_assistant_reply', { mode: 'boolean' })
    .notNull()
    .default(false),
  assistant_question_count: integer('assistant_question_count').notNull().default(0),
  first_response_was_tool: integer('first_response_was_tool', { mode: 'boolean' })
    .notNull()
    .default(false),
  retry_signal_count: integer('retry_signal_count').notNull().default(0),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  session_id: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  content_text: text('content_text').notNull(),
  cwd: text('cwd'),
  git_branch: text('git_branch'),
  timestamp: text('timestamp').notNull(),
  token_count_estimate: integer('token_count_estimate').notNull().default(0),
  word_count: integer('word_count').notNull().default(0),
  has_file_path: integer('has_file_path', { mode: 'boolean' }).notNull().default(false),
  has_code_block: integer('has_code_block', { mode: 'boolean' }).notNull().default(false),
  has_error_message: integer('has_error_message', { mode: 'boolean' }).notNull().default(false),
  is_interrogative: integer('is_interrogative', { mode: 'boolean' }).notNull().default(false),
  retry_signal: integer('retry_signal', { mode: 'boolean' }).notNull().default(false),
});

export const toolCalls = sqliteTable('tool_calls', {
  id: text('id').primaryKey(),
  session_id: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  message_id: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  tool_name: text('tool_name').notNull(),
  arguments_json: text('arguments_json').notNull(),
  result_summary: text('result_summary'),
  timestamp: text('timestamp').notNull(),
});

export const summaries = sqliteTable('summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  period: text('period', { enum: ['daily', 'weekly', 'per-project'] }).notNull(),
  date: text('date').notNull(),
  project_path: text('project_path'),
  content_md: text('content_md').notNull(),
  model_used: text('model_used').notNull(),
  generated_at: text('generated_at').notNull(),
});

export const fileOffsets = sqliteTable('file_offsets', {
  session_file_path: text('session_file_path').primaryKey(),
  last_byte_read: integer('last_byte_read').notNull().default(0),
  last_processed_at: text('last_processed_at').notNull(),
});
```

- [ ] **Step 5: Create `packages/db/src/index.ts`**

```ts
export * from './schema.js';
export { getDb, closeDb, type TraceDb } from './client.js';
export { migrate } from './migrate.js';
```

- [ ] **Step 6: Typecheck (will fail until client/migrate exist; create empty stubs to unblock)**

Create `packages/db/src/client.ts`:

```ts
export type TraceDb = unknown;
export function getDb(_path?: string): TraceDb {
  throw new Error('not implemented');
}
export function closeDb(_db: TraceDb): void {
  throw new Error('not implemented');
}
```

Create `packages/db/src/migrate.ts`:

```ts
import type { TraceDb } from './client.js';
export function migrate(_db: TraceDb): void {
  throw new Error('not implemented');
}
```

Run: `pnpm --filter @trace/db typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add packages/db/ pnpm-lock.yaml
git commit -m "feat(db): drizzle schema for sessions, messages, tool_calls, summaries, file_offsets"
git push
```

### Task 12: Initial SQL migration with FTS5 + triggers

**Files:**
- Create: `packages/db/src/migrations/0000_init.sql`

The migration creates the same tables Drizzle describes, then adds the FTS5 virtual table and the sync triggers. SQLite FTS5 support is built into the better-sqlite3 prebuilds.

- [ ] **Step 1: Create `packages/db/src/migrations/0000_init.sql`**

```sql
-- 0000_init.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  cwd TEXT NOT NULL,
  project_name TEXT NOT NULL,
  git_branch TEXT,
  ai_title TEXT,
  first_user_message TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  turn_count INTEGER NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  ended_without_assistant_reply INTEGER NOT NULL DEFAULT 0,
  assistant_question_count INTEGER NOT NULL DEFAULT 0,
  first_response_was_tool INTEGER NOT NULL DEFAULT 0,
  retry_signal_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions (project_name);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  content_text TEXT NOT NULL,
  cwd TEXT,
  git_branch TEXT,
  timestamp TEXT NOT NULL,
  token_count_estimate INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  has_file_path INTEGER NOT NULL DEFAULT 0,
  has_code_block INTEGER NOT NULL DEFAULT 0,
  has_error_message INTEGER NOT NULL DEFAULT 0,
  is_interrogative INTEGER NOT NULL DEFAULT 0,
  retry_signal INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages (role);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  arguments_json TEXT NOT NULL,
  result_summary TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls (session_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_name ON tool_calls (tool_name);

CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL CHECK (period IN ('daily','weekly','per-project')),
  date TEXT NOT NULL,
  project_path TEXT,
  content_md TEXT NOT NULL,
  model_used TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_offsets (
  session_file_path TEXT PRIMARY KEY,
  last_byte_read INTEGER NOT NULL DEFAULT 0,
  last_processed_at TEXT NOT NULL
);

-- Full-text search over messages.content_text. Contentless FTS5 with manual sync.
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5 (
  content_text,
  session_id UNINDEXED,
  message_id UNINDEXED,
  timestamp UNINDEXED,
  tokenize = 'porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages
BEGIN
  INSERT INTO messages_fts (rowid, content_text, session_id, message_id, timestamp)
  VALUES (new.rowid, new.content_text, new.session_id, new.id, new.timestamp);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages
BEGIN
  INSERT INTO messages_fts (messages_fts, rowid, content_text, session_id, message_id, timestamp)
  VALUES ('delete', old.rowid, old.content_text, old.session_id, old.id, old.timestamp);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages
BEGIN
  INSERT INTO messages_fts (messages_fts, rowid, content_text, session_id, message_id, timestamp)
  VALUES ('delete', old.rowid, old.content_text, old.session_id, old.id, old.timestamp);
  INSERT INTO messages_fts (rowid, content_text, session_id, message_id, timestamp)
  VALUES (new.rowid, new.content_text, new.session_id, new.id, new.timestamp);
END;
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/migrations/0000_init.sql
git commit -m "feat(db): initial sqlite migration with fts5 virtual table"
git push
```

### Task 13: Client + migrate

**Files:**
- Modify: `packages/db/src/client.ts`
- Modify: `packages/db/src/migrate.ts`
- Create: `packages/db/test/queries.test.ts` (will be filled in Task 14; write skeleton now)

- [ ] **Step 1: Replace `packages/db/src/client.ts`**

```ts
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TRACE_DB_PATH } from '@trace/shared';
import * as schema from './schema.js';
import { migrate } from './migrate.js';

export type TraceDb = BetterSQLite3Database<typeof schema> & { sqlite: Database.Database };

export function getDb(path: string = TRACE_DB_PATH): TraceDb {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema }) as TraceDb;
  db.sqlite = sqlite;
  migrate(db);
  return db;
}

export function closeDb(db: TraceDb): void {
  db.sqlite.close();
}
```

- [ ] **Step 2: Replace `packages/db/src/migrate.ts`**

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { TraceDb } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrations = ['0000_init.sql'];

export function migrate(db: TraceDb): void {
  for (const file of migrations) {
    const sql = readFileSync(join(here, 'migrations', file), 'utf8');
    db.sqlite.exec(sql);
  }
}
```

- [ ] **Step 3: Smoke test that an in-memory db opens and runs migration**

Create `packages/db/test/queries.test.ts`:

```ts
import { describe, expect, it, afterEach } from 'vitest';
import { getDb, closeDb, sessions } from '../src/index.js';

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
```

- [ ] **Step 4: Resolve the `__dirname` problem for migrations path**

The migrate file uses `import.meta.url`. Confirm `packages/db/src/migrations/0000_init.sql` is bundled with the source (it is — we're not building, just running TS). Ensure `package.json` has `"files": []` removed or absent (it isn't there, good).

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run packages/db/`
Expected: 1 passing.

If FTS5 is missing: better-sqlite3 prebuilds normally include it. If the test fails with "no such module: fts5", reinstall with `pnpm rebuild better-sqlite3` and rerun.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/client.ts packages/db/src/migrate.ts packages/db/test/queries.test.ts
git commit -m "feat(db): client + migrate apply init.sql with fts5"
git push
```

### Task 14: Query helpers per surface

**Files:**
- Create: `packages/db/src/queries/today.ts`
- Create: `packages/db/src/queries/projects.ts`
- Create: `packages/db/src/queries/project-detail.ts`
- Create: `packages/db/src/queries/search.ts`
- Create: `packages/db/src/queries/patterns.ts`
- Create: `packages/db/src/queries/session-detail.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/test/queries.test.ts`

Conventions: every query helper takes the `TraceDb` as the first arg. Returns plain objects, not Drizzle row types, so dashboard server components don't import Drizzle.

- [ ] **Step 1: Create `packages/db/src/queries/today.ts`**

```ts
import { sql } from 'drizzle-orm';
import type { TraceDb } from '../client.js';

export interface TodaySummary {
  date: string;
  message_count: number;
  session_count: number;
  token_estimate: number;
  headline: string | null;
  deck: string;
}

export interface ProjectLedgerRow {
  project_name: string;
  cwd: string;
  session_count: number;
  message_count: number;
  ai_title: string | null;
  open_thread: boolean;
  last_touched: string;
  spark: number[]; // 14 daily counts oldest → newest
}

export function getTodaySummary(db: TraceDb, todayIso: string): TodaySummary {
  const start = `${todayIso}T00:00:00.000Z`;
  const end = `${todayIso}T23:59:59.999Z`;

  const stats = db.sqlite
    .prepare<[string, string], { msgs: number; tokens: number; sessions: number }>(
      `SELECT
         COUNT(*) AS msgs,
         COALESCE(SUM(token_count_estimate), 0) AS tokens,
         COUNT(DISTINCT session_id) AS sessions
       FROM messages
       WHERE timestamp >= ? AND timestamp <= ?`,
    )
    .get(start, end) ?? { msgs: 0, tokens: 0, sessions: 0 };

  const headlineRow = db.sqlite
    .prepare<[string, string], { ai_title: string | null }>(
      `SELECT s.ai_title
       FROM sessions s
       JOIN messages m ON m.session_id = s.id
       WHERE m.timestamp >= ? AND m.timestamp <= ?
       GROUP BY s.id
       ORDER BY COUNT(m.id) DESC
       LIMIT 1`,
    )
    .get(start, end);

  const projectsToday = db.sqlite
    .prepare<[string, string], { project_name: string }>(
      `SELECT DISTINCT s.project_name
       FROM sessions s JOIN messages m ON m.session_id = s.id
       WHERE m.timestamp >= ? AND m.timestamp <= ?`,
    )
    .all(start, end);

  const sessionsCount = stats.sessions;
  const projectsCount = projectsToday.length;
  const deck =
    sessionsCount === 0
      ? 'No sessions today.'
      : `${sessionsCount} session${sessionsCount === 1 ? '' : 's'} across ${projectsCount} project${projectsCount === 1 ? '' : 's'}, ${stats.msgs} messages.`;

  return {
    date: todayIso,
    message_count: stats.msgs,
    session_count: stats.sessions,
    token_estimate: stats.tokens,
    headline: headlineRow?.ai_title ?? null,
    deck,
  };
}

export function getProjectLedgerForToday(db: TraceDb, todayIso: string): ProjectLedgerRow[] {
  const start = `${todayIso}T00:00:00.000Z`;
  const end = `${todayIso}T23:59:59.999Z`;

  type Row = {
    project_name: string;
    cwd: string;
    session_count: number;
    message_count: number;
    ai_title: string | null;
    open_thread: number;
    last_touched: string;
  };

  const rows = db.sqlite
    .prepare<[string, string], Row>(
      `WITH latest AS (
         SELECT s.project_name, MAX(s.ended_at) AS last_touched
         FROM sessions s
         GROUP BY s.project_name
       )
       SELECT
         s.project_name,
         s.cwd,
         COUNT(DISTINCT s.id) AS session_count,
         COUNT(m.id)          AS message_count,
         (SELECT ai_title FROM sessions s2
            WHERE s2.project_name = s.project_name
            ORDER BY s2.ended_at DESC LIMIT 1) AS ai_title,
         (SELECT ended_without_assistant_reply FROM sessions s3
            WHERE s3.project_name = s.project_name
            ORDER BY s3.ended_at DESC LIMIT 1) AS open_thread,
         latest.last_touched
       FROM sessions s
       JOIN latest ON latest.project_name = s.project_name
       LEFT JOIN messages m
         ON m.session_id = s.id
        AND m.timestamp >= ? AND m.timestamp <= ?
       GROUP BY s.project_name
       ORDER BY latest.last_touched DESC`,
    )
    .all(start, end);

  return rows.map((r) => ({
    project_name: r.project_name,
    cwd: r.cwd,
    session_count: r.session_count,
    message_count: r.message_count,
    ai_title: r.ai_title,
    open_thread: Boolean(r.open_thread),
    last_touched: r.last_touched,
    spark: getDailyMessageCountsForProject(db, r.project_name, 14),
  }));
}

function getDailyMessageCountsForProject(db: TraceDb, project: string, days: number): number[] {
  type Row = { day: string; n: number };
  const rows = db.sqlite
    .prepare<[string, number], Row>(
      `SELECT substr(m.timestamp, 1, 10) AS day, COUNT(*) AS n
       FROM messages m JOIN sessions s ON s.id = m.session_id
       WHERE s.project_name = ?
       GROUP BY day
       ORDER BY day DESC
       LIMIT ?`,
    )
    .all(project, days);
  // Pad to `days` length oldest → newest. Missing days = 0.
  const today = new Date();
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const hit = rows.find((r) => r.day === iso);
    out.push(hit ? hit.n : 0);
  }
  return out;
}

export function getDailyMessageCounts(db: TraceDb, days: number): number[] {
  type Row = { day: string; n: number };
  const rows = db.sqlite
    .prepare<[number], Row>(
      `SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS n
       FROM messages
       GROUP BY day
       ORDER BY day DESC
       LIMIT ?`,
    )
    .all(days);
  const today = new Date();
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const hit = rows.find((r) => r.day === iso);
    out.push(hit ? hit.n : 0);
  }
  return out;
}
```

- [ ] **Step 2: Create `packages/db/src/queries/projects.ts`**

```ts
import type { TraceDb } from '../client.js';

export interface ProjectCard {
  project_name: string;
  cwd: string;
  last_touched: string;
  current_focus: string | null;
  open_thread: boolean;
  total_sessions: number;
  total_messages: number;
  spark: number[];
  stalled_days: number;
}

export function getProjectCards(db: TraceDb, days: number = 14): ProjectCard[] {
  type Row = {
    project_name: string;
    cwd: string;
    total_sessions: number;
    total_messages: number;
    last_touched: string;
    ai_title: string | null;
    open_thread: number;
  };

  const rows = db.sqlite
    .prepare<[], Row>(
      `SELECT
         s.project_name,
         s.cwd,
         COUNT(DISTINCT s.id) AS total_sessions,
         COUNT(m.id)          AS total_messages,
         MAX(s.ended_at)      AS last_touched,
         (SELECT ai_title FROM sessions s2
            WHERE s2.project_name = s.project_name
            ORDER BY s2.ended_at DESC LIMIT 1) AS ai_title,
         (SELECT ended_without_assistant_reply FROM sessions s3
            WHERE s3.project_name = s.project_name
            ORDER BY s3.ended_at DESC LIMIT 1) AS open_thread
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       GROUP BY s.project_name
       ORDER BY last_touched DESC`,
    )
    .all();

  const now = Date.now();
  return rows.map((r) => {
    const last = Date.parse(r.last_touched);
    const stalled = Math.max(0, Math.floor((now - last) / (1000 * 60 * 60 * 24)));
    return {
      project_name: r.project_name,
      cwd: r.cwd,
      last_touched: r.last_touched,
      current_focus: r.ai_title,
      open_thread: Boolean(r.open_thread),
      total_sessions: r.total_sessions,
      total_messages: r.total_messages,
      spark: getProjectSpark(db, r.project_name, days),
      stalled_days: stalled,
    };
  });
}

function getProjectSpark(db: TraceDb, project: string, days: number): number[] {
  type Row = { day: string; n: number };
  const rows = db.sqlite
    .prepare<[string, number], Row>(
      `SELECT substr(m.timestamp, 1, 10) AS day, COUNT(*) AS n
       FROM messages m JOIN sessions s ON s.id = m.session_id
       WHERE s.project_name = ?
       GROUP BY day
       ORDER BY day DESC
       LIMIT ?`,
    )
    .all(project, days);
  const today = new Date();
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const hit = rows.find((r) => r.day === iso);
    out.push(hit ? hit.n : 0);
  }
  return out;
}
```

- [ ] **Step 3: Create `packages/db/src/queries/project-detail.ts`**

```ts
import type { TraceDb } from '../client.js';

export interface ProjectDetail {
  project_name: string;
  cwd: string;
  current_focus: string | null;
  total_sessions: number;
  total_messages: number;
  last_touched: string;
  sessions: SessionTimelineRow[];
}

export interface SessionTimelineRow {
  id: string;
  ai_title: string | null;
  first_user_message: string | null;
  started_at: string;
  ended_at: string;
  message_count: number;
  ended_without_assistant_reply: boolean;
}

export function getProjectDetail(db: TraceDb, projectName: string): ProjectDetail | null {
  const meta = db.sqlite
    .prepare<[string], { cwd: string; total_sessions: number; total_messages: number; last_touched: string; ai_title: string | null }>(
      `SELECT
         s.cwd,
         COUNT(DISTINCT s.id) AS total_sessions,
         COUNT(m.id)          AS total_messages,
         MAX(s.ended_at)      AS last_touched,
         (SELECT ai_title FROM sessions s2 WHERE s2.project_name = ? ORDER BY s2.ended_at DESC LIMIT 1) AS ai_title
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       WHERE s.project_name = ?`,
    )
    .get(projectName, projectName);

  if (!meta || !meta.cwd) return null;

  type Row = {
    id: string;
    ai_title: string | null;
    first_user_message: string | null;
    started_at: string;
    ended_at: string;
    message_count: number;
    ended_without_assistant_reply: number;
  };

  const sessionsRows = db.sqlite
    .prepare<[string], Row>(
      `SELECT id, ai_title, first_user_message, started_at, ended_at, message_count, ended_without_assistant_reply
       FROM sessions
       WHERE project_name = ?
       ORDER BY ended_at DESC`,
    )
    .all(projectName);

  return {
    project_name: projectName,
    cwd: meta.cwd,
    current_focus: meta.ai_title,
    total_sessions: meta.total_sessions,
    total_messages: meta.total_messages,
    last_touched: meta.last_touched,
    sessions: sessionsRows.map((r) => ({
      id: r.id,
      ai_title: r.ai_title,
      first_user_message: r.first_user_message,
      started_at: r.started_at,
      ended_at: r.ended_at,
      message_count: r.message_count,
      ended_without_assistant_reply: Boolean(r.ended_without_assistant_reply),
    })),
  };
}
```

- [ ] **Step 4: Create `packages/db/src/queries/search.ts`**

```ts
import type { TraceDb } from '../client.js';

export interface SearchResult {
  message_id: string;
  session_id: string;
  ai_title: string | null;
  project_name: string;
  timestamp: string;
  role: 'user' | 'assistant';
  snippet: string;
}

export interface SearchOptions {
  projects?: string[];
  role?: 'user' | 'assistant';
  limit?: number;
}

export function searchMessages(db: TraceDb, query: string, opts: SearchOptions = {}): SearchResult[] {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const limit = opts.limit ?? 50;
  const filters: string[] = [];
  const params: (string | number)[] = [trimmed];

  if (opts.role) {
    filters.push('m.role = ?');
    params.push(opts.role);
  }
  if (opts.projects && opts.projects.length > 0) {
    filters.push(`s.project_name IN (${opts.projects.map(() => '?').join(',')})`);
    params.push(...opts.projects);
  }

  const where = filters.length === 0 ? '' : 'AND ' + filters.join(' AND ');

  type Row = {
    message_id: string;
    session_id: string;
    ai_title: string | null;
    project_name: string;
    timestamp: string;
    role: 'user' | 'assistant';
    snippet: string;
  };

  const sql = `
    SELECT
      m.id AS message_id,
      m.session_id AS session_id,
      s.ai_title AS ai_title,
      s.project_name AS project_name,
      m.timestamp AS timestamp,
      m.role AS role,
      snippet(messages_fts, 0, '<mark>', '</mark>', '…', 16) AS snippet
    FROM messages_fts
    JOIN messages m ON m.id = messages_fts.message_id
    JOIN sessions s ON s.id = m.session_id
    WHERE messages_fts MATCH ?
    ${where}
    ORDER BY m.timestamp DESC
    LIMIT ${limit}
  `;

  return db.sqlite.prepare<typeof params, Row>(sql).all(...params);
}
```

- [ ] **Step 5: Create `packages/db/src/queries/patterns.ts`**

```ts
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
  one_shot_trend: number[]; // weekly buckets, percent
  retry_phrases: { phrase: string; count: number; sessions: number }[];
  drifted_sessions: DriftedSession[];
  length_histogram: number[]; // 20 bins from 1 to 200+ words
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

  // Retry phrases via LIKE on content_text. Coarse but cheap.
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
  // 20 bins, edges at multiples of 10 up to 200, then a 200+ bin.
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

import type { DriftedSession as DS } from './patterns.js';

function computeDriftedSessions(db: TraceDb, sinceIso: string): DS[] {
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

  const flagged: DS[] = [];
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
```

(The `import type { DriftedSession as DS }` line near the bottom is intentional — it lets the local function reference the exported type without renaming. If your linter complains, hoist the declaration.)

- [ ] **Step 6: Create `packages/db/src/queries/session-detail.ts`**

```ts
import type { TraceDb } from '../client.js';

export interface SessionDetail {
  id: string;
  project_name: string;
  ai_title: string | null;
  started_at: string;
  ended_at: string;
  messages: SessionMessage[];
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  content_text: string;
}

export function getSessionDetail(db: TraceDb, sessionId: string): SessionDetail | null {
  type SRow = {
    id: string;
    project_name: string;
    ai_title: string | null;
    started_at: string;
    ended_at: string;
  };
  const session = db.sqlite
    .prepare<[string], SRow>(
      `SELECT id, project_name, ai_title, started_at, ended_at FROM sessions WHERE id = ?`,
    )
    .get(sessionId);
  if (!session) return null;

  type MRow = { id: string; role: 'user' | 'assistant'; timestamp: string; content_text: string };
  const messages = db.sqlite
    .prepare<[string], MRow>(
      `SELECT id, role, timestamp, content_text FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
    )
    .all(sessionId);

  return { ...session, messages };
}
```

- [ ] **Step 7: Update `packages/db/src/index.ts` to re-export queries**

```ts
export * from './schema.js';
export { getDb, closeDb, type TraceDb } from './client.js';
export { migrate } from './migrate.js';
export * from './queries/today.js';
export * from './queries/projects.js';
export * from './queries/project-detail.js';
export * from './queries/search.js';
export * from './queries/patterns.js';
export * from './queries/session-detail.js';
```

- [ ] **Step 8: Add seeded query tests**

Replace `packages/db/test/queries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getDb, closeDb } from '../src/client.js';
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
```

- [ ] **Step 9: Run db tests**

Run: `pnpm vitest run packages/db/`
Expected: All passing.

- [ ] **Step 10: Commit**

```bash
git add packages/db/src/queries/ packages/db/src/index.ts packages/db/test/queries.test.ts
git commit -m "feat(db): query helpers for today, projects, search, patterns, session detail"
git push
```

---

## Phase D — Watcher

### Task 15: `apps/watcher` skeleton + entry

**Files:**
- Create: `apps/watcher/package.json`
- Create: `apps/watcher/tsconfig.json`
- Create: `apps/watcher/src/index.ts`
- Create: `apps/watcher/src/watch.ts`

- [ ] **Step 1: Create `apps/watcher/package.json`**

```json
{
  "name": "@trace/watcher",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@trace/db": "workspace:*",
    "@trace/parser": "workspace:*",
    "@trace/shared": "workspace:*",
    "chokidar": "^4.0.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `apps/watcher/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Install deps**

Run: `pnpm install`

- [ ] **Step 4: Create `apps/watcher/src/watch.ts`**

```ts
import chokidar from 'chokidar';
import { CLAUDE_PROJECTS_DIR } from '@trace/shared';
import type { TraceDb } from '@trace/db';
import { processFile } from './process-file.js';

export function startWatcher(db: TraceDb, dir: string = CLAUDE_PROJECTS_DIR) {
  const watcher = chokidar.watch(`${dir}/**/*.jsonl`, {
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    ignoreInitial: false,
  });

  watcher.on('add', (path) => processFile(db, path));
  watcher.on('change', (path) => processFile(db, path));
  watcher.on('error', (err) => {
    console.error('[watcher] error', err);
  });

  return watcher;
}
```

- [ ] **Step 5: Create `apps/watcher/src/index.ts`**

```ts
import { getDb, closeDb } from '@trace/db';
import { TRACE_DB_PATH } from '@trace/shared';
import { startWatcher } from './watch.js';

const db = getDb(TRACE_DB_PATH);
const watcher = startWatcher(db);

console.log(`[watcher] watching ${process.env.HOME}/.claude/projects/`);
console.log(`[watcher] writing to ${TRACE_DB_PATH}`);

const shutdown = async () => {
  console.log('[watcher] shutting down');
  await watcher.close();
  closeDb(db);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

- [ ] **Step 6: Create empty `apps/watcher/src/process-file.ts` so imports compile**

```ts
import type { TraceDb } from '@trace/db';
export function processFile(_db: TraceDb, _path: string): void {
  // implemented in Task 16
}
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @trace/watcher typecheck`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add apps/watcher/ pnpm-lock.yaml
git commit -m "feat(watcher): skeleton with chokidar entry"
git push
```

### Task 16: `process-file` and `inserts` (offset-tracked, idempotent)

**Files:**
- Create: `apps/watcher/src/inserts.ts`
- Modify: `apps/watcher/src/process-file.ts`

The strategy: when a file changes, read from the byte offset stored in `file_offsets`, parse each new line, insert messages, then update or insert the session aggregate row. The whole thing runs inside one SQLite transaction per file change so partial inserts don't leave the file_offset ahead of the data.

- [ ] **Step 1: Create `apps/watcher/src/inserts.ts`**

```ts
import type { TraceDb } from '@trace/db';
import type { ParsedEvent } from '@trace/shared';
import { basename } from 'node:path';

export function insertEvent(
  db: TraceDb,
  filePath: string,
  ev: ParsedEvent,
): void {
  if (ev.kind === 'noise') return;
  if (ev.kind === 'ai-title') {
    db.sqlite
      .prepare(`UPDATE sessions SET ai_title = ? WHERE id = ?`)
      .run(ev.aiTitle, ev.sessionId);
    return;
  }

  // Ensure session row exists. Project name comes from the file's parent dir basename
  // shape (e.g. -Users-bryce-Personal-projects-trace) — we prefer the message's cwd.
  const projectName =
    ev.cwd && ev.cwd !== ''
      ? basename(ev.cwd)
      : decodeProjectFromFilePath(filePath);
  const cwd = ev.cwd ?? '';
  ensureSession(db, ev.sessionId, cwd, projectName, ev.gitBranch ?? null, ev.timestamp);

  // Insert message. ON CONFLICT DO NOTHING keeps reruns idempotent.
  db.sqlite
    .prepare(
      `INSERT INTO messages (
         id, session_id, role, content, content_text, cwd, git_branch, timestamp, token_count_estimate,
         word_count, has_file_path, has_code_block, has_error_message, is_interrogative, retry_signal
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT(id) DO NOTHING`,
    )
    .run(
      ev.uuid,
      ev.sessionId,
      ev.role,
      JSON.stringify(ev.contentRaw),
      ev.contentText,
      ev.cwd ?? null,
      ev.gitBranch ?? null,
      ev.timestamp,
      ev.tokenCountEstimate,
      ev.features.word_count,
      bool(ev.features.has_file_path),
      bool(ev.features.has_code_block),
      bool(ev.features.has_error_message),
      bool(ev.features.is_interrogative),
      bool(ev.features.retry_signal),
    );

  // Tool calls
  for (const tc of ev.toolCalls) {
    db.sqlite
      .prepare(
        `INSERT INTO tool_calls (id, session_id, message_id, tool_name, arguments_json, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run(tc.id, ev.sessionId, ev.uuid, tc.name, tc.arguments_json, ev.timestamp);
  }

  // Roll up session aggregates
  recomputeSessionAggregates(db, ev.sessionId);
}

function decodeProjectFromFilePath(filePath: string): string {
  // Last directory: -Users-bryce-Personal-projects-trace → trace
  const parent = basename(filePath.replace(/\/[^/]+$/, ''));
  const segments = parent.split('-').filter((s) => s !== '');
  return segments.at(-1) ?? 'unknown';
}

function ensureSession(
  db: TraceDb,
  id: string,
  cwd: string,
  projectName: string,
  gitBranch: string | null,
  timestamp: string,
): void {
  db.sqlite
    .prepare(
      `INSERT INTO sessions (id, cwd, project_name, git_branch, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         cwd = excluded.cwd,
         project_name = excluded.project_name,
         git_branch = COALESCE(excluded.git_branch, sessions.git_branch)`,
    )
    .run(id, cwd, projectName, gitBranch, timestamp, timestamp);
}

function recomputeSessionAggregates(db: TraceDb, sessionId: string): void {
  // message_count, turn_count, tool_call_count, retry_signal_count, ended_at,
  // ended_without_assistant_reply, first_user_message, assistant_question_count,
  // first_response_was_tool.
  db.sqlite
    .prepare(
      `UPDATE sessions SET
         message_count = (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id),
         turn_count    = (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id AND role = 'user'),
         tool_call_count = (SELECT COUNT(*) FROM tool_calls WHERE session_id = sessions.id),
         retry_signal_count = (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id AND role = 'user' AND retry_signal = 1),
         assistant_question_count = (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id AND role = 'assistant' AND content_text LIKE '%?%'),
         ended_at = (SELECT MAX(timestamp) FROM messages WHERE session_id = sessions.id),
         started_at = (SELECT MIN(timestamp) FROM messages WHERE session_id = sessions.id),
         first_user_message = (
           SELECT content_text FROM messages
           WHERE session_id = sessions.id AND role = 'user'
           ORDER BY timestamp ASC LIMIT 1
         ),
         ended_without_assistant_reply = (
           SELECT CASE WHEN role = 'user' THEN 1 ELSE 0 END
           FROM messages WHERE session_id = sessions.id
           ORDER BY timestamp DESC LIMIT 1
         ),
         first_response_was_tool = (
           SELECT CASE
             WHEN EXISTS (
               SELECT 1 FROM tool_calls tc
               WHERE tc.session_id = sessions.id
                 AND tc.message_id = (
                   SELECT id FROM messages
                   WHERE session_id = sessions.id AND role = 'assistant'
                   ORDER BY timestamp ASC LIMIT 1
                 )
             ) THEN 1 ELSE 0 END
         )
       WHERE id = ?`,
    )
    .run(sessionId);
}

function bool(b: boolean): 0 | 1 {
  return b ? 1 : 0;
}
```

- [ ] **Step 2: Replace `apps/watcher/src/process-file.ts`**

```ts
import { readFileSync, statSync } from 'node:fs';
import { parseLine } from '@trace/parser';
import type { TraceDb } from '@trace/db';
import { insertEvent } from './inserts.js';

export function processFile(db: TraceDb, filePath: string): void {
  let size: number;
  try {
    size = statSync(filePath).size;
  } catch {
    return; // file disappeared between event and read
  }

  type OffsetRow = { last_byte_read: number };
  const row = db.sqlite
    .prepare<[string], OffsetRow>(
      `SELECT last_byte_read FROM file_offsets WHERE session_file_path = ?`,
    )
    .get(filePath);

  const start = row?.last_byte_read ?? 0;
  if (start >= size) return;

  // Read the new tail.
  const buf = readFileSync(filePath);
  const slice = buf.slice(start);
  const text = slice.toString('utf8');

  // Find the last full newline boundary so we don't parse a half line.
  const lastNewline = text.lastIndexOf('\n');
  const consumeUpTo = lastNewline === -1 ? -1 : lastNewline;
  if (consumeUpTo === -1) return;

  const lines = text.slice(0, consumeUpTo).split('\n').filter((l) => l !== '');

  const txn = db.sqlite.transaction(() => {
    for (const line of lines) {
      const ev = parseLine(line);
      if (ev) insertEvent(db, filePath, ev);
    }
    db.sqlite
      .prepare(
        `INSERT INTO file_offsets (session_file_path, last_byte_read, last_processed_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(session_file_path) DO UPDATE SET
           last_byte_read = excluded.last_byte_read,
           last_processed_at = excluded.last_processed_at`,
      )
      .run(filePath, start + consumeUpTo + 1);
  });

  txn();
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @trace/watcher typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/watcher/src/inserts.ts apps/watcher/src/process-file.ts
git commit -m "feat(watcher): offset-tracked idempotent file processing"
git push
```

### Task 17: Integration test against a temp directory

**Files:**
- Create: `apps/watcher/test/process-file.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, closeDb, type TraceDb } from '@trace/db';
import { processFile } from '../src/process-file.js';

let dir: string;
let db: TraceDb;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trace-watch-'));
  db = getDb(':memory:');
});

afterEach(() => {
  closeDb(db);
  rmSync(dir, { recursive: true, force: true });
});

describe('processFile', () => {
  it('inserts messages from a fresh file', () => {
    const path = join(dir, 'session.jsonl');
    const userLine = JSON.stringify({
      type: 'user',
      sessionId: 'sess-1',
      timestamp: '2026-04-26T12:00:00.000Z',
      uuid: 'uuid-u-1',
      cwd: '/Users/me/projects/trace',
      gitBranch: 'main',
      message: { role: 'user', content: 'fix src/parser.ts' },
    });
    const assistantLine = JSON.stringify({
      type: 'assistant',
      sessionId: 'sess-1',
      timestamp: '2026-04-26T12:00:01.000Z',
      uuid: 'uuid-a-1',
      cwd: '/Users/me/projects/trace',
      message: { role: 'assistant', content: [{ type: 'text', text: 'On it' }] },
    });
    writeFileSync(path, `${userLine}\n${assistantLine}\n`);
    processFile(db, path);

    const messages = db.sqlite.prepare(`SELECT id, role FROM messages ORDER BY timestamp`).all();
    expect(messages).toHaveLength(2);

    const session = db.sqlite
      .prepare(`SELECT message_count, turn_count, project_name FROM sessions WHERE id = 'sess-1'`)
      .get() as { message_count: number; turn_count: number; project_name: string };
    expect(session.message_count).toBe(2);
    expect(session.turn_count).toBe(1);
    expect(session.project_name).toBe('trace');
  });

  it('is idempotent — reprocessing the same file does not duplicate', () => {
    const path = join(dir, 'session.jsonl');
    const line = JSON.stringify({
      type: 'user',
      sessionId: 'sess-2',
      timestamp: '2026-04-26T12:00:00.000Z',
      uuid: 'uuid-u-1',
      message: { role: 'user', content: 'hi' },
    });
    writeFileSync(path, `${line}\n`);
    processFile(db, path);
    processFile(db, path);
    const count = (db.sqlite.prepare(`SELECT COUNT(*) AS n FROM messages`).get() as { n: number })
      .n;
    expect(count).toBe(1);
  });

  it('processes only new bytes on append', () => {
    const path = join(dir, 'session.jsonl');
    const line1 = JSON.stringify({
      type: 'user',
      sessionId: 'sess-3',
      timestamp: '2026-04-26T12:00:00.000Z',
      uuid: 'uuid-u-1',
      message: { role: 'user', content: 'first' },
    });
    writeFileSync(path, `${line1}\n`);
    processFile(db, path);

    const line2 = JSON.stringify({
      type: 'user',
      sessionId: 'sess-3',
      timestamp: '2026-04-26T12:00:01.000Z',
      uuid: 'uuid-u-2',
      message: { role: 'user', content: 'second' },
    });
    appendFileSync(path, `${line2}\n`);
    processFile(db, path);

    const ids = db.sqlite
      .prepare(`SELECT id FROM messages ORDER BY timestamp`)
      .all() as { id: string }[];
    expect(ids.map((r) => r.id)).toEqual(['uuid-u-1', 'uuid-u-2']);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm vitest run apps/watcher/`
Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add apps/watcher/test/process-file.test.ts vitest.config.ts
git commit -m "test(watcher): integration tests for processFile"
git push
```

---

## Phase E — Dashboard scaffolding

### Task 18: Next.js 15 init + Tailwind

**Files:**
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/next.config.mjs`
- Create: `apps/dashboard/tailwind.config.ts`
- Create: `apps/dashboard/postcss.config.mjs`
- Create: `apps/dashboard/src/app/layout.tsx` (placeholder)
- Create: `apps/dashboard/src/app/page.tsx` (placeholder)
- Create: `apps/dashboard/src/app/globals.css` (will fill in Task 19)

- [ ] **Step 1: Create `apps/dashboard/package.json`**

```json
{
  "name": "@trace/dashboard",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@trace/db": "workspace:*",
    "@trace/shared": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `apps/dashboard/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] },
    "incremental": true
  },
  "include": ["src/**/*", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/dashboard/next.config.mjs`**

```ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverExternalPackages: ['better-sqlite3'],
  },
};
export default nextConfig;
```

- [ ] **Step 4: Create `apps/dashboard/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f6f3ec',
        ink: '#1a1a1a',
        dim: '#8a7e63',
        accent: '#c89b7b',
        rule: 'rgba(26, 26, 26, 0.18)',
        quiet: 'rgba(26, 26, 26, 0.06)',
        page: '#ddd6c7',
        good: '#4a7a3f',
        bad: '#a05a3f',
      },
      fontFamily: {
        serif: [
          'Iowan Old Style',
          'Apple Garamond',
          'Hoefler Text',
          'Georgia',
          'Times New Roman',
          'serif',
        ],
        mono: [
          'SF Mono',
          'IBM Plex Mono',
          'JetBrains Mono',
          'ui-monospace',
          'Menlo',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Create `apps/dashboard/postcss.config.mjs`**

```ts
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 6: Create `apps/dashboard/src/app/globals.css` (theme tokens, animation keyframes filled in Task 19)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Create `apps/dashboard/src/app/layout.tsx` (placeholder, real header lands in Task 20)**

```tsx
import './globals.css';

export const metadata = { title: 'Trace', description: 'A second brain for AI-assisted coding' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-page font-serif text-ink">{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create `apps/dashboard/src/app/page.tsx` placeholder**

```tsx
export default function HomePage() {
  return <main className="p-12">Trace dashboard scaffolding</main>;
}
```

- [ ] **Step 9: Install + dev**

Run: `pnpm install`
Run: `pnpm --filter @trace/dashboard dev`
Open: http://localhost:3000
Expected: "Trace dashboard scaffolding" in serif on the tan page background. Stop the dev server with Ctrl-C.

- [ ] **Step 10: Commit**

```bash
git add apps/dashboard/ pnpm-lock.yaml
git commit -m "feat(dashboard): scaffold next.js 15 with tailwind editorial tokens"
git push
```

### Task 19: Editorial theme tokens, fonts, animation keyframes

**Files:**
- Modify: `apps/dashboard/src/app/globals.css`

- [ ] **Step 1: Replace `apps/dashboard/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --paper: #f6f3ec;
  --ink: #1a1a1a;
  --dim: #8a7e63;
  --accent: #c89b7b;
  --rule: rgba(26, 26, 26, 0.18);
  --quiet: rgba(26, 26, 26, 0.06);
  --page: #ddd6c7;
  --good: #4a7a3f;
  --bad: #a05a3f;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
}

html, body { background: var(--page); }

body {
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.serif-numerals { font-feature-settings: "lnum" 1, "tnum" 1; }

@keyframes rise {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes drawRule { to { transform: scaleX(1); } }
@keyframes breathe {
  0%, 100% { opacity: 0.4; transform: scale(0.85); }
  50%      { opacity: 1;   transform: scale(1.1); }
}
@keyframes breatheToday {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.18); }
}
@keyframes drawLine { to { stroke-dashoffset: 0; } }
@keyframes fadeIn { to { opacity: 1; } }

.reveal { opacity: 0; transform: translateY(8px); animation: rise 720ms var(--ease) forwards; }
.r1 { animation-delay: 40ms; }
.r2 { animation-delay: 200ms; }
.r3 { animation-delay: 380ms; }
.r4 { animation-delay: 560ms; }
.r5 { animation-delay: 760ms; }
.r6 { animation-delay: 960ms; }
.r7 { animation-delay: 1160ms; }

.rule {
  position: relative; height: 1px; background: transparent; overflow: hidden;
}
.rule::after {
  content: ''; position: absolute; inset: 0; background: var(--ink); opacity: 0.18;
  transform-origin: left center; transform: scaleX(0);
  animation: drawRule 700ms var(--ease) 320ms forwards;
}

.breathe { animation: breathe 1.6s ease-in-out infinite; }
.breathe-today { animation: breatheToday 2.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }

@media (prefers-reduced-motion: reduce) {
  .reveal { animation: none !important; opacity: 1 !important; transform: none !important; }
  .rule::after { animation: none !important; transform: scaleX(1) !important; }
  .breathe, .breathe-today { animation: none !important; }
}

/* Component utility classes */
.eyebrow {
  font-family: var(--font-mono, 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace);
  font-size: 10.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--dim);
}
.section-label { @apply eyebrow; }
.headline {
  font-size: 38px; line-height: 1.08; letter-spacing: -0.012em;
  font-family: 'Iowan Old Style', 'Apple Garamond', 'Hoefler Text', Georgia, serif;
  font-weight: 400;
}
.deck { font-style: italic; font-size: 15.5px; color: #4a4a4a; line-height: 1.45; }
```

- [ ] **Step 2: Run dev, confirm tokens load**

Run: `pnpm --filter @trace/dashboard dev`
Open: http://localhost:3000
Expected: Same placeholder, but body now serif on tan background. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/globals.css
git commit -m "feat(dashboard): editorial theme tokens and animation keyframes"
git push
```

### Task 20: `AppHeader`, `Reveal`, `Masthead`, `Sparkline`, `Pill`

**Files:**
- Create: `apps/dashboard/src/components/AppHeader.tsx`
- Create: `apps/dashboard/src/components/Reveal.tsx`
- Create: `apps/dashboard/src/components/Masthead.tsx`
- Create: `apps/dashboard/src/components/Sparkline.tsx`
- Create: `apps/dashboard/src/components/Pill.tsx`
- Create: `apps/dashboard/src/lib/format.ts`
- Modify: `apps/dashboard/src/app/layout.tsx`

- [ ] **Step 1: Create `apps/dashboard/src/lib/format.ts`**

```ts
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const seconds = Math.round((now.getTime() - t) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function humanInt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Create `apps/dashboard/src/components/Pill.tsx`**

```tsx
type Variant = 'default' | 'thread' | 'stalled' | 'new';

export function Pill({ variant = 'default', children }: { variant?: Variant; children: React.ReactNode }) {
  const cls = {
    default: 'border-rule text-ink',
    thread: 'border-accent text-[#8c5a38] bg-[rgba(200,155,123,0.10)]',
    stalled: 'border-rule text-dim',
    new: 'border-accent text-accent',
  }[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] ${cls}`}
    >
      {variant === 'thread' && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Create `apps/dashboard/src/components/Sparkline.tsx`**

```tsx
export function Sparkline({ values, accent = false }: { values: number[]; accent?: boolean }) {
  const max = Math.max(1, ...values);
  const w = 80;
  const h = 26;
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${i * stepX},${h - (v / max) * (h - 4) - 2}`);
  const d = `M${points.join(' L')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[26px] w-20">
      <path
        d={d}
        fill="none"
        stroke={accent ? 'var(--accent)' : 'var(--ink)'}
        strokeWidth={accent ? 1.4 : 1.2}
      />
    </svg>
  );
}
```

- [ ] **Step 4: Create `apps/dashboard/src/components/Reveal.tsx`**

```tsx
export function Reveal({
  delay = 1,
  className = '',
  children,
}: {
  delay?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`reveal r${delay} ${className}`}>{children}</div>;
}
```

- [ ] **Step 5: Create `apps/dashboard/src/components/AppHeader.tsx`**

```tsx
import Link from 'next/link';

export function AppHeader({ active }: { active: 'today' | 'projects' | 'patterns' | 'search' | null }) {
  const link = (key: string, href: string, label: string) => (
    <Link
      key={key}
      href={href}
      className={`rounded px-2 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] transition-colors ${
        active === key ? 'text-ink' : 'text-dim hover:bg-quiet hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );

  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-6 border-b border-rule bg-gradient-to-b from-white/40 to-transparent px-8 py-5">
      <div className="inline-flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.22em] text-ink">
        <span className="inline-block h-3 w-3 rounded-sm bg-accent" />
        TRACE
        <nav className="ml-3 flex gap-1 border-l border-rule pl-3">
          {link('today', '/', 'Today')}
          {link('projects', '/projects', 'Projects')}
          {link('patterns', '/patterns', 'Patterns')}
          {link('search', '/search', 'Search')}
        </nav>
      </div>

      <form action="/search" className="relative mx-auto w-full max-w-[460px]">
        <svg className="absolute left-[13px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-55" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          type="text"
          name="q"
          placeholder="Search every session…"
          className="w-full rounded-full border border-transparent bg-[rgba(26,26,26,0.04)] px-4 py-2.5 pl-9 text-[14.5px] text-ink placeholder:italic placeholder:text-dim focus:border-ink focus:bg-white focus:shadow-[0_4px_16px_-8px_rgba(26,26,26,0.25)] focus:outline-none"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.1em] text-dim">
          ⌘ K
        </span>
      </form>

      <div className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.18em] text-dim">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent breathe align-middle" />
        {date}
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Create `apps/dashboard/src/components/Masthead.tsx`**

```tsx
export function Masthead({
  eyebrow,
  headline,
  deck,
}: {
  eyebrow: string;
  headline: string;
  deck?: string;
}) {
  return (
    <>
      <div className="reveal r1 eyebrow mb-1.5">{eyebrow}</div>
      <h1 className="reveal r2 headline mb-3 max-w-[22ch]">{headline}</h1>
      {deck && <p className="reveal r2 deck mb-5 max-w-[56ch]">{deck}</p>}
    </>
  );
}
```

- [ ] **Step 7: Update `apps/dashboard/src/app/layout.tsx` to wrap children with the page chrome**

```tsx
import './globals.css';
import { AppHeader } from '@/components/AppHeader';

export const metadata = { title: 'Trace', description: 'A second brain for AI-assisted coding' };

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Record<string, string>;
}) {
  void params;
  return (
    <html lang="en">
      <body className="min-h-screen bg-page font-serif text-ink">
        <div className="mx-auto max-w-[880px] px-6 py-8">
          <div className="overflow-hidden rounded-sm bg-paper shadow-[0_1px_1px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.18)]">
            <AppHeader active={null} />
            <div className="px-16 py-10">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
```

(The active state is `null` here because layout doesn't know the route. Each page can render its own `AppHeader` if the active highlight matters; for v1 the header is "static" enough that we can leave the layout's render and skip per-page customization, or each page can opt to render its own header. We'll keep it simple: all pages share the layout's header with no active state.)

- [ ] **Step 8: Run dev and confirm header renders**

Run: `pnpm --filter @trace/dashboard dev`
Open: http://localhost:3000
Expected: header appears with TRACE wordmark, search input, breathing date dot, and the placeholder body.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/components/ apps/dashboard/src/lib/ apps/dashboard/src/app/layout.tsx
git commit -m "feat(dashboard): app header, masthead, sparkline, pill, reveal"
git push
```

---

## Phase F — Routes

### Task 21: Today (/)

**Files:**
- Modify: `apps/dashboard/src/app/page.tsx`
- Create: `apps/dashboard/src/components/ProjectRow.tsx`
- Create: `apps/dashboard/src/components/AmbientChart.tsx`
- Create: `apps/dashboard/src/lib/db.ts`

- [ ] **Step 1: Create `apps/dashboard/src/lib/db.ts` (lazy singleton)**

```ts
import { getDb, type TraceDb } from '@trace/db';

declare global {
  // eslint-disable-next-line no-var
  var __traceDb: TraceDb | undefined;
}

export function db(): TraceDb {
  if (!globalThis.__traceDb) globalThis.__traceDb = getDb();
  return globalThis.__traceDb;
}
```

- [ ] **Step 2: Create `apps/dashboard/src/components/ProjectRow.tsx`**

```tsx
import { Sparkline } from './Sparkline';
import { Pill } from './Pill';
import { relativeTime } from '@/lib/format';

export interface ProjectRowProps {
  name: string;
  cwd: string;
  sessionCount: number;
  messageCount: number;
  aiTitle: string | null;
  openThread: boolean;
  lastTouched: string;
  spark: number[];
  primary?: boolean;
}

export function ProjectRow(props: ProjectRowProps) {
  const { name, sessionCount, messageCount, aiTitle, openThread, lastTouched, spark, primary } = props;
  return (
    <a
      href={`/projects/${encodeURIComponent(name)}`}
      className="relative grid cursor-pointer grid-cols-[1.5fr_1.4fr_100px_80px] items-center gap-5 border-b border-rule py-5 transition-colors hover:bg-[rgba(200,155,123,0.06)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-4 top-4 bottom-4 w-0.5 origin-top scale-y-0 bg-accent transition-transform [a:hover>&]:scale-y-100"
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-[22px] tracking-[-0.012em] leading-tight">{name}</span>
        <span className="flex flex-wrap items-center gap-2.5 font-mono text-[10.5px] tracking-[0.06em] text-dim">
          <span>{relativeTime(lastTouched)}</span>
          {sessionCount > 0 && <Pill>{sessionCount} {sessionCount === 1 ? 'SESSION' : 'SESSIONS'}</Pill>}
          {openThread && <Pill variant="thread">OPEN THREAD</Pill>}
          {sessionCount === 0 && <Pill variant="stalled">QUIET</Pill>}
        </span>
      </div>
      <div className={`italic text-[15px] leading-snug ${aiTitle ? 'text-[#444]' : 'text-dim'}`}>
        {aiTitle ?? 'No AI-generated title yet.'}
      </div>
      <div className="text-right font-mono text-[10.5px] leading-relaxed tracking-[0.06em] text-dim">
        <strong className="serif-numerals block font-serif text-base font-normal tracking-[-0.01em] text-ink">
          {messageCount}
        </strong>
        msg
      </div>
      <Sparkline values={spark} accent={primary} />
    </a>
  );
}
```

- [ ] **Step 3: Create `apps/dashboard/src/components/AmbientChart.tsx`**

```tsx
export function AmbientChart({ values }: { values: number[] }) {
  const w = 600;
  const h = 40;
  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * stepX, h - (v / max) * (h - 6) - 2] as const);
  const path = `M${pts.map((p) => `${p[0]},${p[1]}`).join(' L')}`;
  const area = `${path} L${w},${h} L0,${h} Z`;
  const today = pts[pts.length - 1];
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <div className="mt-9 grid grid-cols-[auto_1fr_auto] items-center gap-6 border-t border-rule pt-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-dim">14 days · ambient</span>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full">
        <path d={area} fill="var(--accent)" opacity={0.15} />
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1} opacity={0.7} />
        {today && (
          <circle
            cx={today[0]}
            cy={today[1]}
            r={2.5}
            fill="var(--accent)"
            stroke="var(--ink)"
            strokeWidth={1}
            className="breathe-today"
          />
        )}
      </svg>
      <span className="whitespace-nowrap font-serif text-sm text-dim">
        <strong className="text-ink serif-numerals">{total.toLocaleString()}</strong> msg / 14d
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Replace `apps/dashboard/src/app/page.tsx`**

```tsx
import {
  getTodaySummary,
  getProjectLedgerForToday,
  getDailyMessageCounts,
} from '@trace/db';
import { db } from '@/lib/db';
import { Masthead } from '@/components/Masthead';
import { ProjectRow } from '@/components/ProjectRow';
import { AmbientChart } from '@/components/AmbientChart';
import { humanInt, todayIso, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function Home() {
  const today = todayIso();
  const summary = getTodaySummary(db(), today);
  const ledger = getProjectLedgerForToday(db(), today);
  const fourteen = getDailyMessageCounts(db(), 14);

  const eyebrow = `Today · ${formatDate(`${today}T12:00:00Z`)}`;
  const headline = summary.headline ?? 'Quiet day.';

  const sessionCount = summary.session_count;
  const projectsCount = ledger.filter((p) => p.session_count > 0).length;
  const stalledCount = ledger.length - projectsCount;
  const ledgerLabel = `${sessionCount} session${sessionCount === 1 ? '' : 's'} · ${projectsCount} active${stalledCount > 0 ? ` · ${stalledCount} quiet` : ''}`;

  return (
    <>
      <Masthead eyebrow={eyebrow} headline={headline} deck={summary.deck} />

      <div className="reveal r3 mb-7 flex items-center gap-4 font-mono text-[11.5px] tracking-[0.04em] text-dim">
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{summary.message_count}</strong>{' '}
          messages
        </span>
        <span className="h-3.5 w-px bg-rule" />
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{summary.session_count}</strong>{' '}
          sessions
        </span>
        <span className="h-3.5 w-px bg-rule" />
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{humanInt(summary.token_estimate)}</strong>{' '}
          tokens
        </span>
      </div>

      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 mb-4 flex items-baseline justify-between">
        <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">Today's projects</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">{ledgerLabel}</span>
      </div>

      <div className="reveal r5 flex flex-col">
        {ledger.length === 0 && (
          <p className="py-6 italic text-dim">
            No sessions yet. Run Claude Code in any project and this page will fill in.
          </p>
        )}
        {ledger.map((row, i) => (
          <ProjectRow
            key={row.project_name}
            name={row.project_name}
            cwd={row.cwd}
            sessionCount={row.session_count}
            messageCount={row.message_count}
            aiTitle={row.ai_title}
            openThread={row.open_thread}
            lastTouched={row.last_touched}
            spark={row.spark}
            primary={i === 0}
          />
        ))}
      </div>

      <div className="reveal r6">
        <AmbientChart values={fourteen} />
      </div>
    </>
  );
}
```

- [ ] **Step 5: Confirm it renders without data**

Run: `pnpm --filter @trace/dashboard dev`
Open: http://localhost:3000
Expected: Empty state ("No sessions yet…") in italic. The chart shows zero values. Header looks right.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/lib/db.ts apps/dashboard/src/components/ProjectRow.tsx apps/dashboard/src/components/AmbientChart.tsx apps/dashboard/src/app/page.tsx
git commit -m "feat(dashboard): home (today) page with masthead, ledger, ambient chart"
git push
```

### Task 22: Search (/search)

**Files:**
- Create: `apps/dashboard/src/app/search/page.tsx`

- [ ] **Step 1: Create `apps/dashboard/src/app/search/page.tsx`**

```tsx
import { searchMessages } from '@trace/db';
import { db } from '@/lib/db';
import { relativeTime } from '@/lib/format';
import { Masthead } from '@/components/Masthead';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const results = query === '' ? [] : searchMessages(db(), query, { limit: 50 });

  const headline = query === '' ? 'Search every session.' : `Results for "${query}"`;
  const deck =
    query === ''
      ? 'Type a phrase in the header search to find anything you ever said to Claude.'
      : `${results.length} match${results.length === 1 ? '' : 'es'} across all sessions.`;

  return (
    <>
      <Masthead eyebrow="Search" headline={headline} deck={deck} />
      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 flex flex-col">
        {results.map((r) => (
          <a
            key={r.message_id}
            href={`/sessions/${r.session_id}`}
            className="block border-b border-rule py-4 transition-colors hover:bg-[rgba(200,155,123,0.06)]"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-serif text-base tracking-[-0.005em]">
                {r.ai_title ?? '(untitled session)'}
              </span>
              <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
                {r.project_name} · {relativeTime(r.timestamp)}
              </span>
            </div>
            <p
              className="mt-2 font-serif italic text-[14.5px] leading-snug text-[#444]"
              dangerouslySetInnerHTML={{ __html: r.snippet }}
            />
          </a>
        ))}
        {query !== '' && results.length === 0 && (
          <p className="py-6 italic text-dim">No matches.</p>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Confirm /search?q=… returns reasonable HTML**

Run dev, open http://localhost:3000/search?q=test. Empty database → "No matches." Header search submits to /search and returns here. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/search/
git commit -m "feat(dashboard): search results page using fts5"
git push
```

### Task 23: Projects (/projects)

**Files:**
- Create: `apps/dashboard/src/app/projects/page.tsx`

- [ ] **Step 1: Create `apps/dashboard/src/app/projects/page.tsx`**

```tsx
import { getProjectCards } from '@trace/db';
import { db } from '@/lib/db';
import { Sparkline } from '@/components/Sparkline';
import { Pill } from '@/components/Pill';
import { Masthead } from '@/components/Masthead';
import { relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  const cards = getProjectCards(db(), 14);
  return (
    <>
      <Masthead
        eyebrow="Projects"
        headline="Everything you're building, side by side."
        deck={`${cards.length} project${cards.length === 1 ? '' : 's'} touched. Sorted by last activity.`}
      />
      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 grid grid-cols-1 gap-5 md:grid-cols-2">
        {cards.length === 0 && (
          <p className="col-span-2 py-6 italic text-dim">No projects yet.</p>
        )}
        {cards.map((c, i) => (
          <a
            key={c.project_name}
            href={`/projects/${encodeURIComponent(c.project_name)}`}
            className="group flex flex-col gap-3 border border-rule bg-paper/60 p-5 transition-colors hover:bg-paper"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-serif text-[22px] tracking-[-0.012em]">{c.project_name}</span>
              {c.open_thread && <Pill variant="thread">OPEN</Pill>}
              {c.stalled_days >= 7 && !c.open_thread && (
                <Pill variant="stalled">STALLED · {c.stalled_days}d</Pill>
              )}
            </div>
            <p className={`font-serif italic text-[14.5px] leading-snug ${c.current_focus ? 'text-[#444]' : 'text-dim'}`}>
              {c.current_focus ?? 'No focus yet.'}
            </p>
            <div className="flex items-baseline justify-between gap-3 font-mono text-[10.5px] tracking-[0.06em] text-dim">
              <span>
                <strong className="font-serif text-base text-ink serif-numerals">{c.total_sessions}</strong> sessions ·{' '}
                <strong className="font-serif text-base text-ink serif-numerals">{c.total_messages}</strong> msg
              </span>
              <span>{relativeTime(c.last_touched)}</span>
            </div>
            <Sparkline values={c.spark} accent={i === 0} />
          </a>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Confirm /projects renders**

Run dev, open http://localhost:3000/projects. Empty state should show with "No projects yet."

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/projects/page.tsx
git commit -m "feat(dashboard): projects portfolio grid"
git push
```

### Task 24: Project detail (/projects/[slug])

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/page.tsx`

- [ ] **Step 1: Create `apps/dashboard/src/app/projects/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { getProjectDetail } from '@trace/db';
import { db } from '@/lib/db';
import { Masthead } from '@/components/Masthead';
import { Pill } from '@/components/Pill';
import { relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const projectName = decodeURIComponent(slug);
  const detail = getProjectDetail(db(), projectName);
  if (!detail) notFound();

  return (
    <>
      <Masthead
        eyebrow="Project"
        headline={detail.project_name}
        deck={detail.current_focus ?? 'No focus generated yet.'}
      />
      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 mb-7 flex items-baseline gap-4 font-mono text-[11.5px] tracking-[0.04em] text-dim">
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{detail.total_sessions}</strong> sessions
        </span>
        <span className="h-3.5 w-px bg-rule" />
        <span>
          <strong className="font-serif text-lg text-ink serif-numerals">{detail.total_messages}</strong> messages
        </span>
        <span className="h-3.5 w-px bg-rule" />
        <span>last touched {relativeTime(detail.last_touched)}</span>
      </div>

      <h2 className="reveal r5 mb-3 font-serif text-[22px] font-normal tracking-[-0.01em]">Sessions</h2>
      <div className="reveal r6 flex flex-col">
        {detail.sessions.length === 0 && (
          <p className="py-6 italic text-dim">No sessions yet.</p>
        )}
        {detail.sessions.map((s) => (
          <a
            key={s.id}
            href={`/sessions/${s.id}`}
            className="block border-b border-rule py-5 transition-colors hover:bg-[rgba(200,155,123,0.06)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-serif text-[18px] tracking-[-0.01em]">
                {s.ai_title ?? '(untitled session)'}
              </span>
              {s.ended_without_assistant_reply && <Pill variant="thread">OPEN THREAD</Pill>}
            </div>
            <p className="mt-1 font-serif italic text-[14.5px] leading-snug text-[#444]">
              {s.first_user_message ?? ''}
            </p>
            <div className="mt-2 flex items-baseline gap-3 font-mono text-[10.5px] tracking-[0.06em] text-dim">
              <span>{relativeTime(s.ended_at)}</span>
              <span>·</span>
              <span>
                <strong className="font-serif text-base text-ink serif-numerals">{s.message_count}</strong> msg
              </span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Smoke test**

Run dev, navigate to a non-existent project (e.g. /projects/nope) and confirm Next.js renders the 404. Real projects will resolve once the watcher inserts data.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/projects/[slug]/
git commit -m "feat(dashboard): project detail page"
git push
```

### Task 25: Patterns (/patterns)

**Files:**
- Create: `apps/dashboard/src/app/patterns/page.tsx`
- Create: `apps/dashboard/src/components/LengthHistogram.tsx`
- Create: `apps/dashboard/src/components/PatternBar.tsx`
- Create: `apps/dashboard/src/components/DriftRow.tsx`
- Create: `apps/dashboard/src/lib/patterns-derived.ts`

- [ ] **Step 1: Create `apps/dashboard/src/components/LengthHistogram.tsx`**

```tsx
export function LengthHistogram({ bins }: { bins: number[] }) {
  const max = Math.max(1, ...bins);
  const medianBinIndex = pickMedianBinIndex(bins);
  return (
    <>
      <div className="grid h-24 items-end gap-[3px] border-b border-rule pb-1" style={{ gridTemplateColumns: `repeat(${bins.length}, 1fr)` }}>
        {bins.map((n, i) => (
          <div
            key={i}
            className={`rounded-[1px] ${i === medianBinIndex || i === medianBinIndex - 1 || i === medianBinIndex + 1 ? 'bg-accent opacity-100' : 'bg-ink/85'}`}
            style={{ height: `${(n / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">
        <span>1 word</span>
        <span>median</span>
        <span>200+</span>
      </div>
    </>
  );
}

function pickMedianBinIndex(bins: number[]): number {
  const total = bins.reduce((a, b) => a + b, 0);
  if (total === 0) return -1;
  let acc = 0;
  for (let i = 0; i < bins.length; i++) {
    acc += bins[i] ?? 0;
    if (acc >= total / 2) return i;
  }
  return bins.length - 1;
}
```

- [ ] **Step 2: Create `apps/dashboard/src/components/PatternBar.tsx`**

```tsx
export function PatternBar({
  name,
  pct,
  delta,
  emphasis = false,
}: {
  name: string;
  pct: number;
  delta?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-2">
      <span className="font-serif text-[15.5px]">{name}</span>
      <span className="font-serif text-base tracking-[-0.01em] serif-numerals">{pct}%</span>
      <div className="col-span-2 mt-1 h-1 overflow-hidden rounded-[2px] bg-quiet">
        <div className={`h-full ${emphasis ? 'bg-accent' : 'bg-ink'}`} style={{ width: `${pct}%` }} />
      </div>
      {delta && <span className="col-span-2 font-mono text-[10.5px] tracking-[0.04em] text-dim">{delta}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/dashboard/src/components/DriftRow.tsx`**

```tsx
import { relativeTime } from '@/lib/format';

export function DriftRow({
  id,
  whenIso,
  project,
  reason,
  flag,
}: {
  id: string;
  whenIso: string;
  project: string;
  reason: string;
  flag: 'DRIFT' | 'VAGUE' | 'SHIFTING';
}) {
  return (
    <a
      href={`/sessions/${id}`}
      className="grid grid-cols-[1.4fr_1fr_1.6fr_auto] items-center gap-4 border-b border-rule py-3.5 transition-colors hover:bg-[rgba(160,90,63,0.04)]"
    >
      <span className="font-mono text-[11px] tracking-[0.06em] text-dim">{relativeTime(whenIso)}</span>
      <span className="font-serif text-base">{project}</span>
      <span className="font-serif italic text-sm leading-snug text-[#444]">{reason}</span>
      <span className="rounded-full border border-bad/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bad">
        {flag}
      </span>
    </a>
  );
}
```

- [ ] **Step 4: Create `apps/dashboard/src/lib/patterns-derived.ts`**

```ts
import type { PatternsData } from '@trace/db';

export function derivePatternsHeadlineDeck(p: PatternsData): { headline: string; deck: string } {
  if (p.total_user_prompts === 0) {
    return {
      headline: 'No prompts yet.',
      deck: 'Use Claude Code for a few sessions and this page fills in.',
    };
  }
  const fp = p.prompt_anatomy.has_file_path_pct;
  const oneShot = p.one_shot_rate_pct;
  const median = p.median_word_count;
  const headline =
    median >= 50
      ? 'Your prompts are leaning long and specific.'
      : median >= 20
        ? 'Your prompts are getting more concrete.'
        : 'Your prompts are short. Concrete tends to land faster.';
  const deck = `${fp}% include a file path. One-shot success at ${oneShot}%. Median prompt length: ${median} words across ${p.total_user_prompts} prompts in the last 14 days.`;
  return { headline, deck };
}
```

- [ ] **Step 5: Create `apps/dashboard/src/app/patterns/page.tsx`**

```tsx
import { getPatterns } from '@trace/db';
import { db } from '@/lib/db';
import { Masthead } from '@/components/Masthead';
import { LengthHistogram } from '@/components/LengthHistogram';
import { PatternBar } from '@/components/PatternBar';
import { DriftRow } from '@/components/DriftRow';
import { derivePatternsHeadlineDeck } from '@/lib/patterns-derived';

export const dynamic = 'force-dynamic';

export default function PatternsPage() {
  const p = getPatterns(db(), 14);
  const { headline, deck } = derivePatternsHeadlineDeck(p);

  return (
    <>
      <Masthead eyebrow="Your prompting · last 14 days" headline={headline} deck={deck} />
      <div className="reveal r3 rule mb-6" />

      <section className="reveal r3">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">Prompt length</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">
            14 days · {p.total_user_prompts} user prompts
          </span>
        </div>
        <LengthHistogram bins={p.length_histogram} />
        <div className="mt-4 grid grid-cols-3 gap-6 font-mono text-[11px] tracking-[0.04em] text-dim">
          <div>
            <span className="block font-serif text-[22px] tracking-[-0.01em] text-ink serif-numerals">
              {p.median_word_count}
            </span>
            Median words
          </div>
          <div>
            <span className="block font-serif text-[22px] tracking-[-0.01em] text-ink serif-numerals">
              {p.share_under_10_words}%
            </span>
            Under 10 words
          </div>
          <div>
            <span className="block font-serif text-[22px] tracking-[-0.01em] text-ink serif-numerals">
              {p.one_shot_rate_pct}%
            </span>
            One-shot rate (≤3 turns)
          </div>
        </div>
      </section>

      <section className="reveal r4 mt-9">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">Prompt anatomy</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">
            Share of prompts containing each signal
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-7">
          <PatternBar name="File path" pct={p.prompt_anatomy.has_file_path_pct} emphasis />
          <PatternBar name="Code block" pct={p.prompt_anatomy.has_code_block_pct} emphasis />
          <PatternBar name="Error message" pct={p.prompt_anatomy.has_error_message_pct} />
          <PatternBar name="Imperative" pct={p.prompt_anatomy.is_imperative_pct} />
          <PatternBar name="Question, no context" pct={p.prompt_anatomy.is_interrogative_pct} />
        </div>
      </section>

      <section className="reveal r5 mt-9">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">
            Where you redirect Claude
          </h2>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">
            Most-used retry phrases
          </span>
        </div>
        <div className="grid grid-cols-[1.5fr_1fr] gap-9">
          <div className="flex flex-col">
            {p.retry_phrases.length === 0 && (
              <p className="py-3 italic text-dim">No retry phrases detected yet.</p>
            )}
            {p.retry_phrases.map((r, i) => (
              <div key={r.phrase} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 border-b border-rule py-2.5">
                <span className="w-6 font-mono text-[10px] tracking-[0.18em] text-dim">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-serif italic text-base">"{r.phrase}"</span>
                <span className="font-mono text-[11px] tracking-[0.06em] text-dim">
                  <strong className="font-serif text-base font-normal tracking-[-0.01em] text-ink">
                    {r.count}
                  </strong>{' '}
                  · {r.sessions} session{r.sessions === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
          <aside className="border-l-2 border-accent bg-[rgba(200,155,123,0.08)] p-4 font-serif italic text-[15.5px] leading-snug text-[#2b2a28]">
            <strong className="not-italic text-ink">Heuristic.</strong> Counts come straight from local data, no scoring by AI. Adding constraints up front tends to save 2–4 turns when these phrases would otherwise appear.
            <span className="mt-2 block font-mono text-[9.5px] uppercase tracking-[0.18em] text-dim">
              Derived · not a confident causal claim
            </span>
          </aside>
        </div>
      </section>

      <section className="reveal r6 mt-9">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 font-serif text-[22px] font-normal tracking-[-0.01em]">Sessions that drifted</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-dim">
            Likely doom loops · click to review
          </span>
        </div>
        <div className="flex flex-col">
          {p.drifted_sessions.length === 0 && (
            <p className="py-3 italic text-dim">No drifted sessions in the last 14 days.</p>
          )}
          {p.drifted_sessions.map((s) => (
            <DriftRow
              key={s.id}
              id={s.id}
              whenIso={s.ended_at}
              project={s.project_name}
              reason={s.reason}
              flag={s.flag}
            />
          ))}
        </div>
      </section>

      <p className="reveal r7 mt-12 border-t border-rule pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
        All metrics derived from local data — no scoring by AI
      </p>
    </>
  );
}
```

- [ ] **Step 6: Confirm /patterns renders empty-state copy correctly**

Run dev, open http://localhost:3000/patterns. Empty database → "No prompts yet" headline.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/components/LengthHistogram.tsx apps/dashboard/src/components/PatternBar.tsx apps/dashboard/src/components/DriftRow.tsx apps/dashboard/src/lib/patterns-derived.ts apps/dashboard/src/app/patterns/page.tsx
git commit -m "feat(dashboard): patterns surface (length, anatomy, retries, drift)"
git push
```

### Task 26: Session detail (/sessions/[id]) — raw text only

**Files:**
- Create: `apps/dashboard/src/app/sessions/[id]/page.tsx`

The full marginalia reading view is Weekend 2. v1 ships a list of role + content_text blocks under the eyebrow + headline.

- [ ] **Step 1: Create `apps/dashboard/src/app/sessions/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { getSessionDetail } from '@trace/db';
import { db } from '@/lib/db';
import { Masthead } from '@/components/Masthead';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = getSessionDetail(db(), id);
  if (!session) notFound();

  return (
    <>
      <Masthead
        eyebrow={`${session.project_name} · ${formatDate(session.started_at)}`}
        headline={session.ai_title ?? '(untitled session)'}
        deck={`${session.messages.length} message${session.messages.length === 1 ? '' : 's'}.`}
      />
      <div className="reveal r3 rule mb-6" />

      <div className="reveal r4 flex flex-col gap-6">
        {session.messages.map((m) => (
          <div key={m.id} className="grid grid-cols-[88px_1fr] items-baseline gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
              {m.role}
            </div>
            <div className={`whitespace-pre-wrap font-serif text-[15.5px] leading-relaxed ${m.role === 'user' ? 'text-ink' : 'text-[#3a3a3a]'}`}>
              {m.content_text}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Smoke test**

Run dev, hit /sessions/nonsense and confirm 404. Real sessions will resolve once watcher writes them.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/sessions/
git commit -m "feat(dashboard): session detail (raw text in v1)"
git push
```

---

## Phase G — Wiring

### Task 27: Top-level `pnpm dev` runs watcher + dashboard concurrently

**Files:**
- Modify: `package.json` (already has the script — confirm and run)

- [ ] **Step 1: Run the workspace dev script**

Run: `pnpm dev`
Expected: Two streams in the same terminal: `[watcher]` printing the watch path, `[dashboard]` printing the Next.js URL. The dashboard is reachable at http://localhost:3000.

- [ ] **Step 2: Verify both processes shut down cleanly with Ctrl-C**

Press Ctrl-C. Both processes should exit. The SQLite database should remain at `~/Trace/trace.db`.

- [ ] **Step 3: Commit any tweaks**

If `concurrently` argument quoting needed adjusting on your shell, commit that change. Otherwise nothing to commit.

```bash
git status
# If clean, no commit. Otherwise:
git commit -m "chore: tweak pnpm dev orchestration"
git push
```

### Task 28: Smoke run against real data + README polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run `pnpm dev` and use Claude Code in another window**

Run: `pnpm dev`
In a third terminal, start a Claude Code session in any project (e.g. `cd ~/Personal/projects/trace && claude`). Ask Claude something trivial. Watch the watcher log a file change.

- [ ] **Step 2: Open the dashboard**

Open http://localhost:3000. Within seconds, the masthead should show today's `aiTitle`, the project ledger should list the project, and the ambient chart should have a non-zero value for today.

- [ ] **Step 3: Sanity-check each surface**

- `/projects` shows the project as a card.
- `/projects/<name>` shows the session in the timeline with the user prompt as the excerpt.
- `/sessions/<id>` shows the messages in order.
- `/search?q=<a phrase you typed>` returns the message with the phrase highlighted via `<mark>`.
- `/patterns` shows non-zero numbers (length distribution, anatomy bars, retry phrase list, drift list possibly empty).

If any surface fails, capture the error, file an issue locally, and fix in a follow-up commit. Common failures and fixes:
- Empty headline on home: `getTodaySummary` returned no `ai_title` because `ai-title` line hasn't arrived yet. Wait a few seconds and reload.
- `better-sqlite3` build error: run `pnpm rebuild better-sqlite3`.
- FTS5 errors: confirm the migration applied — `sqlite3 ~/Trace/trace.db ".tables"` should list `messages_fts`.

- [ ] **Step 4: Update README**

Replace `README.md` with:

```markdown
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

MIT (planned, once made public).
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README for the working vertical slice"
git push
```

- [ ] **Step 6: Confirm tests still pass**

Run: `pnpm test`
Expected: All passing.

- [ ] **Step 7: Confirm typecheck across the workspace**

Run: `pnpm -r typecheck`
Expected: All passing.

---

## Self-review summary

**Spec coverage:**
- Recall: search query helper + `/search` route — Tasks 14, 22.
- Portfolio: today + projects + project-detail queries and routes — Tasks 14, 21, 23, 24.
- Patterns: parser features + db query + `/patterns` route — Tasks 9, 14, 25.
- Schema with Patterns columns + FTS5 — Tasks 11, 12.
- Editorial aesthetic: theme tokens, animation keyframes, components — Tasks 19, 20.
- Vertical-slice DoD: real-time watcher + 5 live surfaces + 1 stub — Tasks 16, 17, 21–26, 27, 28.

**Out of scope (deferred to Weekend 2+ as specified):**
- Summarizer app, launchd agent, marginalia session view, per-project weekly summaries, time-of-day heatmap, coach view, cost surfacing.

**Risks acknowledged:**
- Format drift handled by `parseLine` returning `null` on unknown shapes (Task 5).
- FTS5 + Drizzle handled via raw SQL migration + `db.sqlite.prepare` for queries (Task 12, 14).
- Patterns false confidence guarded by integrity copy in the UI and by counting features (not scoring) in the query (Tasks 14, 25).
