import { agent, bash, edit, grep, interrupt, read, reject, write, you, type Script } from './dsl.js';

// Four made-up projects and three weeks of made-up sessions. The habits Trace
// should catch are planted on purpose:
//   ledger:     "use pnpm" (fixed 8 days ago), the test command
//   everywhere: comments that restate the code, force pushes
//   fieldnotes: reuse the Prose component
// Everything else is ordinary work, so the strips look like real days.

const L = 'ledger';
const T = 'tidepool';
const F = 'fieldnotes';
const R = 'relay';

export const scripts: Script[] = [
  // ledger: pnpm, four times, then fixed.
  {
    id: 'a1', project: L, day: -18, at: 16, title: 'Add CSV import for bank statements',
    steps: [
      you('add a csv import for bank statements. chase and amex exports, see fixtures/statements/', 0),
      agent('I\'ll look at the fixtures first.', [read('fixtures/statements/chase.csv'), read('fixtures/statements/amex.csv')]),
      agent('Both have a header row and ISO dates. I\'ll add papaparse.', [bash('npm install papaparse @types/papaparse')], 20),
      you('no, use pnpm. this is a pnpm repo', 35),
      agent('Sorry about that. Switching to pnpm.', [bash('rm package-lock.json'), bash('pnpm add papaparse && pnpm add -D @types/papaparse')]),
      agent('Added `src/import/csv.ts` with a parser per bank and a shared `Transaction` shape.', [write('src/import/csv.ts'), edit('src/import/index.ts')], 70),
      you('nice. amex amounts are negative for charges, flip them', 90),
      agent('Flipped the sign for Amex and added a test.', [edit('src/import/csv.ts'), write('src/import/csv.test.ts'), bash('pnpm vitest run src/import')], 40),
    ],
  },
  {
    id: 'a2', project: L, day: -15, at: 18, title: 'Budget categories with emoji icons',
    steps: [
      you('categories should have an icon. let people pick an emoji', 0),
      agent('I\'ll add an `icon` column and a picker.', [read('src/db/schema.ts'), edit('src/db/schema.ts'), write('drizzle/0007_category_icon.sql')], 60),
      agent('Installing an emoji picker.', [bash('npm i emoji-picker-react')], 15),
      reject('pnpm not npm', 9),
      agent('Right, pnpm.', [bash('pnpm add emoji-picker-react')], 12),
      agent('The picker opens from the category row and saves on select.', [write('src/components/CategoryIcon.tsx'), edit('src/app/categories/page.tsx')], 80),
      you('looks good', 120),
    ],
  },
  {
    id: 'a3', project: L, day: -12, at: 15, title: 'Monthly rollover for unspent budget',
    steps: [
      you('when a month closes, unspent budget should roll into next month for categories that opt in', 0),
      agent('Reading how months close today.', [grep('closeMonth'), read('src/budget/close-month.ts')], 30),
      agent('I\'ll add `rollover` to categories and carry the remainder forward in `closeMonth`.', [edit('src/db/schema.ts'), edit('src/budget/close-month.ts')], 75),
      agent('Running the tests.', [bash('npm test')], 10),
      interrupt(5),
      you('i said pnpm. every time', 14),
      agent('Running with pnpm.', [bash('pnpm test', 'Tests  41 passed')], 30),
      you('add a toggle for it on the category page', 60),
      agent('Added a rollover switch next to the amount.', [edit('src/app/categories/[id]/page.tsx')], 45),
    ],
  },
  {
    id: 'a4', project: L, day: -9, at: 17, title: 'Upgrade Next and fix the build',
    steps: [
      you('upgrade next to 15 and fix whatever breaks', 0),
      agent('Upgrading.', [bash('npx npm-check-updates -u next react react-dom && npm install')], 25),
      you('pnpm, not npm', 20),
      agent('Using pnpm.', [bash('pnpm up next@15 react@19 react-dom@19')], 40),
      agent('Two breaks: `params` is a promise now, and one `cookies()` call needs await. Fixed both.', [bash('pnpm build'), edit('src/app/accounts/[id]/page.tsx'), edit('src/lib/session.ts'), bash('pnpm build')], 140),
      you('ship it', 60),
    ],
  },

  // ledger: the test command, still open.
  {
    id: 'a5', project: L, day: -6, at: 16, title: 'Fix rounding in split transactions',
    steps: [
      you('splits are off by a cent sometimes. $10 split 3 ways shows 3.33 x3', 0),
      agent('I\'ll put the leftover cent on the first split.', [read('src/budget/split.ts'), edit('src/budget/split.ts')], 50),
      agent('Running the tests.', [bash('npx jest src/budget')], 15),
      you('we use vitest. run `pnpm vitest run` instead', 25),
      agent('Running vitest.', [bash('pnpm vitest run src/budget', 'Tests  12 passed')], 25),
      you('good. add a test for the 3 way case', 40),
      agent('Added.', [edit('src/budget/split.test.ts'), bash('pnpm vitest run src/budget')], 30),
    ],
  },
  {
    id: 'a6', project: L, day: -3, at: 19, title: 'Recurring transactions detector',
    steps: [
      you('detect recurring transactions (same payee, similar amount, monthly). show them on the dashboard', 0),
      agent('I\'ll group by payee and look for a ~30 day cadence.', [write('src/insights/recurring.ts'), write('src/insights/recurring.test.ts')], 110),
      agent('Checking it.', [bash('pnpm test --watch')], 10),
      interrupt(4),
      you('no watch mode. use `pnpm vitest run`', 12),
      agent('Running once.', [bash('pnpm vitest run src/insights', 'Tests  6 passed')], 20),
      agent('Added a Recurring card to the dashboard.', [write('src/components/RecurringCard.tsx'), edit('src/app/page.tsx')], 70),
      you('nice', 90),
    ],
  },
  {
    id: 'a7', project: L, day: 0, at: 0, title: 'Export a year as a tax summary',
    steps: [
      you('export a year of transactions as a tax summary csv, grouped by category', 0),
      agent('Adding `exportTaxSummary` and a button on the year view.', [write('src/export/tax-summary.ts'), edit('src/app/years/[year]/page.tsx')], 90),
      agent('Testing.', [bash('npx vitest')], 10),
      you('no, `pnpm vitest run`', 18),
      agent('Running.', [bash('pnpm vitest run src/export', 'Tests  4 passed')], 20),
    ],
  },

  // Comments that restate the code: three projects.
  {
    id: 'c1', project: L, day: -14, at: 20, title: 'Refactor the auth session helpers',
    steps: [
      you('clean up src/lib/session.ts. it grew three ways to read the cookie', 0),
      agent('Merging them into one `readSession`.', [read('src/lib/session.ts'), edit('src/lib/session.ts')], 70),
      you("don't add comments that restate the code. \"// read the session\" above readSession() says nothing", 50),
      agent('Removed those comments.', [edit('src/lib/session.ts')], 20),
    ],
  },
  {
    id: 'c2', project: F, day: -5, at: 17, title: 'Reading time on posts',
    steps: [
      you('show reading time on each post', 0),
      agent('Adding a `readingTime` helper and showing it under the title.', [write('src/lib/reading-time.ts'), edit('src/layouts/Post.astro')], 50),
      you('again, no comments that just restate the code', 40),
      agent('Stripped them.', [edit('src/lib/reading-time.ts')], 12),
    ],
  },
  {
    id: 'c3', project: T, day: -2, at: 18, title: 'Cache tide predictions offline',
    steps: [
      you('cache the last 7 days of tide predictions so the app works offline', 0),
      agent('I\'ll store predictions in SwiftData keyed by station and day.', [read('Tidepool/Data/TideStore.swift'), write('Tidepool/Data/PredictionCache.swift')], 100),
      you('stop adding comments that restate the code', 45),
      agent('Removed them.', [edit('Tidepool/Data/PredictionCache.swift')], 15),
      you('and evict anything older than 7 days on launch', 40),
      agent('Done, in `TidepoolApp.init`.', [edit('Tidepool/TidepoolApp.swift')], 30),
    ],
  },

  // Force pushes: Codex in relay, Claude in fieldnotes.
  {
    id: 'f1', project: R, agent: 'codex', day: -10, at: 21, title: 'Retry failed webhook deliveries',
    steps: [
      you('retry failed deliveries with exponential backoff, max 6 tries', 0),
      agent('Adding a retry queue with backoff to the delivery worker.', [read('internal/deliver/worker.go'), edit('internal/deliver/worker.go'), edit('internal/deliver/backoff.go')], 90),
      agent('Tests pass. Rebasing on main and pushing.', [bash('go test ./...'), bash('git rebase main && git push --force')], 30),
      you('never force push. open a PR from a branch', 20),
      agent('Pushed to `retry-backoff` and opened a PR.', [bash('git push -u origin retry-backoff')], 25),
    ],
  },
  {
    id: 'f2', project: F, day: -4, at: 15, title: 'Fix broken RSS dates',
    steps: [
      you('rss dates are wrong, they show UTC midnight as the day before', 0),
      agent('Formatting dates in UTC in the feed.', [read('src/pages/rss.xml.ts'), edit('src/pages/rss.xml.ts')], 50),
      agent('Pushing the fix.', [bash('git commit -am "fix rss dates" && git push --force origin main')], 15),
      reject('never force push to main', 10),
      agent('Pushing normally.', [bash('git push origin main')], 15),
    ],
  },

  // fieldnotes: the Prose component.
  {
    id: 'p1', project: F, day: -7, at: 16, title: 'Style footnotes',
    steps: [
      you('footnotes look awful. make them small and put a hairline above them', 0),
      agent('Adding footnote styles to a new stylesheet.', [write('src/styles/footnotes.css')], 40),
      you("don't write new markdown styles. use the Prose component in src/components/Prose.astro", 35),
      agent('Moved the footnote rules into Prose.', [read('src/components/Prose.astro'), edit('src/components/Prose.astro')], 40),
    ],
  },
  {
    id: 'p2', project: F, day: -2, at: 14, title: 'Pull quotes in posts',
    steps: [
      you('add pull quotes. a big italic line that breaks out of the column', 0),
      agent('Adding a pull quote stylesheet.', [write('src/styles/pullquote.css')], 30),
      you('no, use the Prose component. never write new markdown styles', 25),
      agent('Added the pull quote style to Prose.', [edit('src/components/Prose.astro')], 35),
    ],
  },

  // One-offs that don't repeat, so not every correction becomes a fix.
  {
    id: 'o1', project: T, day: -11, at: 17, title: 'Tide chart scrubbing',
    steps: [
      you('let me drag across the tide chart to see the height at any time', 0),
      agent('Adding a drag gesture with a readout.', [read('Tidepool/Views/TideChart.swift'), edit('Tidepool/Views/TideChart.swift')], 80),
      you('the readout jumps around. snap it to the nearest 10 minutes', 50),
      agent('Snapped.', [edit('Tidepool/Views/TideChart.swift')], 20),
      you('perfect', 30),
    ],
  },
  {
    id: 'o2', project: R, agent: 'codex', day: -8, at: 15, title: 'Signing secret rotation',
    steps: [
      you('let customers rotate their signing secret with a 24h overlap', 0),
      agent('Storing two secrets and verifying against both during the overlap.', [edit('internal/sign/verify.go'), edit('internal/api/secrets.go')], 100),
      you('that\'s wrong, the overlap should be per endpoint not per account', 40),
      agent('Moved the overlap to endpoints.', [edit('internal/sign/verify.go'), edit('internal/store/endpoints.go'), bash('go test ./...')], 70),
    ],
  },
  {
    id: 'o3', project: L, day: 0, at: 0, title: 'Search transactions by amount',
    steps: [
      you('let search match amounts. typing 42.10 should find that transaction', 0),
      agent('Adding amount matching to the search query.', [read('src/search/query.ts'), edit('src/search/query.ts'), bash('pnpm vitest run src/search')], 60),
      you('also ranges like 40-50', 50),
      agent('Ranges work now.', [edit('src/search/query.ts'), edit('src/search/query.test.ts'), bash('pnpm vitest run src/search')], 50),
    ],
  },
  {
    id: 'o4', project: T, day: 0, at: 0, title: 'Widget for the next high tide',
    steps: [
      you('add a home screen widget that shows the next high tide', 0),
      agent('Adding a WidgetKit extension with a timeline provider.', [write('TidepoolWidget/NextTide.swift'), edit('Tidepool.xcodeproj/project.pbxproj')], 120),
      you('use the same wave glyph as the app icon', 60),
      agent('Done.', [edit('TidepoolWidget/NextTide.swift')], 25),
    ],
  },
];

// Ordinary sessions that land first time. They fill out the days without
// adding any habits.
export const filler: { project: string; agent?: 'claude' | 'codex'; title: string; prompts: string[]; files: string[] }[] = [
  { project: L, title: 'Dark mode for charts', prompts: ['charts ignore dark mode. use the theme tokens', 'the grid lines are too bright now, halve them'], files: ['src/components/Chart.tsx', 'src/styles/tokens.css'] },
  { project: L, title: 'Account balance history', prompts: ['add a balance over time chart on each account page'], files: ['src/app/accounts/[id]/page.tsx', 'src/insights/balance.ts'] },
  { project: L, title: 'Keyboard shortcuts', prompts: ['add j/k to move through transactions and e to edit', 'show the shortcuts with ?'], files: ['src/hooks/useShortcuts.ts', 'src/components/ShortcutSheet.tsx'] },
  { project: T, title: 'Station search', prompts: ['search stations by name or zip'], files: ['Tidepool/Views/StationSearch.swift', 'Tidepool/Data/Stations.swift'] },
  { project: T, title: 'Moon phase in the header', prompts: ['show the moon phase next to the date', 'smaller, it fights the title'], files: ['Tidepool/Views/Header.swift'] },
  { project: T, title: 'Units setting', prompts: ['let people pick feet or meters'], files: ['Tidepool/Settings/Units.swift', 'Tidepool/Views/TideChart.swift'] },
  { project: F, title: 'Draft posts', prompts: ['posts with draft: true should only show in dev'], files: ['src/content/config.ts', 'src/pages/index.astro'] },
  { project: F, title: 'OG images', prompts: ['generate og images from the post title, same type as the site'], files: ['src/pages/og/[slug].png.ts'] },
  { project: F, title: 'Tag pages', prompts: ['add a page per tag', 'sort tags by post count on the index'], files: ['src/pages/tags/[tag].astro', 'src/pages/tags/index.astro'] },
  { project: R, agent: 'codex', title: 'Delivery log filters', prompts: ['filter the delivery log by status and endpoint'], files: ['internal/api/deliveries.go', 'web/src/Deliveries.tsx'] },
  { project: R, agent: 'codex', title: 'Rate limit per endpoint', prompts: ['rate limit deliveries per endpoint, 10/s default'], files: ['internal/deliver/limit.go'] },
];
