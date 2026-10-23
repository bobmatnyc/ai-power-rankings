# Design-agent spike (M1-5, #178)

The owner ruled on 2026-10-21 that a headless Claude Code agent builds the
design system as code. Claude Design is not used. This document says how that
agent runs and where its output lands. A sample token set ships with it as
proof of the token path.

Flags below are checked against `claude --help` for Claude Code 2.1.308.
References: Claude Code headless mode
(<https://docs.claude.com/en/docs/claude-code/headless>), CLI reference
(<https://docs.claude.com/en/docs/claude-code/cli-reference>), permissions
(<https://docs.claude.com/en/docs/claude-code/iam>) and the Agent SDK
(<https://docs.claude.com/en/docs/claude-code/sdk>).

## 1. Invocation

The agent runs as `claude -p` (`--print`, non-interactive) from a fresh
worktree on a branch off `origin/main`. One run produces one layer: tokens,
then components, then page templates, each as its own PR.

```bash
git fetch origin
git worktree add ../aipr-design-tokens -b feat/design-tokens origin/main
cd ../aipr-design-tokens
npm ci
mkdir -p tmp

claude -p "$(cat docs/refresh/prompts/tokens.md)" \
  --model opus \
  --permission-mode acceptEdits \
  --permission-prompts none \
  --allowedTools "Read Glob Grep Edit Write Bash(npm run test:unit*) Bash(npx tsc --noEmit) Bash(npx vitest run *) Bash(git status*) Bash(git diff*)" \
  --disallowedTools "WebFetch WebSearch Bash(git push*) Bash(npm install*) Bash(vercel *)" \
  --output-format json \
  --max-budget-usd 10 \
  > tmp/design-agent-tokens.json
```

- The prompt file (`docs/refresh/prompts/<layer>.md`, written per run) names
  the inputs: `app/globals.css`, `tailwind.config.js`, `components/ui/*` and
  the token categories from the proposal (colour, type scale, spacing, radius,
  motion, dark mode).
- `--output-format json` returns one result object, so a script can read the
  outcome and cost. `--max-budget-usd` caps API spend; it applies only with
  `--print`.
- The Agent SDK (TypeScript or Python) is the alternative when a script must
  drive several turns or inspect tool calls. It takes the same allowlist and
  permission mode. The CLI form above is enough for one layer per run.

## 2. Permissions and tool allowlist

| Need | Tool rule |
|---|---|
| Read the code | `Read`, `Glob`, `Grep` |
| Write tokens and components | `Edit`, `Write`, with `--permission-mode acceptEdits` |
| Check its own work | `Bash(npx tsc --noEmit)`, `Bash(npm run test:unit*)`, `Bash(npx vitest run *)` |
| Inspect the diff | `Bash(git status*)`, `Bash(git diff*)` |

Denied: network fetches, `git push`, dependency installs and any Vercel
command. `--permission-prompts none` denies anything outside the allowlist
instead of waiting for a human. The operator commits, pushes and opens the PR
after reading the diff; the agent does not. `bypassPermissions` is not used.

## 3. Credentials and plan tier

| Option | How | Trade-off |
|---|---|---|
| A. Subscription login (Pro or Max) | `claude auth` on the operator's machine, or `claude setup-token` for a long-lived token ("requires Claude subscription") | Usage counts against the plan's limits; no per-run bill. Tied to one person's account. Not read under `--bare`. |
| B. API key | `ANTHROPIC_API_KEY` in the shell, or held as a CI secret | Billed per token; `--max-budget-usd` caps each run. Works under `--bare` and in CI. Needs a key owner and a spend limit. |
| C. Cloud provider | Bedrock, Vertex or Foundry credentials | Only if the project already bills through one. It does not. |

The repo holds no Anthropic credential: no `ANTHROPIC_API_KEY` reference in
`.github/` or `vercel.json`. **Owner decision:** A or B, and whose account or
key. A fits a run on the operator's machine; B fits a scripted or CI run.

## 4. Where output lands

| Output | Location |
|---|---|
| Token values | HSL CSS variables in `app/globals.css`, `:root` and `.dark` |
| Token mapping | `theme.extend` in `tailwind.config.js` (`hsl(var(--…))`, as the existing tokens do) |
| Components | `components/ui/` |
| Tests | `tests/unit/` (vitest, `*.test.ts`) |

`app/globals.css` is the only stylesheet: `app/layout.tsx` imports
`./globals.css`. M4-2 (#189) removed the stale `public/globals.css` copy and
its two dead readers; `tests/unit/globals-consolidation-189.test.ts` keeps it
that way.

The proposal's `design/tokens.json` plus Tailwind preset assumed a Claude
Design handoff bundle. With the agent writing code directly, the CSS variables
are the source of truth and no `tokens.json` is needed. **Owner decision:**
keep that or ask for a `tokens.json` export as well.

## 5. Review

1. The agent's run ends with `npx tsc --noEmit` and `npm run test:unit` green.
2. The operator reads the diff, commits and runs `npm run gate:local`, which
   posts the `local-gate` commit status.
3. The PR goes through normal review plus the proposal's design rubric: token
   set complete, WCAG AA text contrast, screenshots at three widths,
   Lighthouse and Core Web Vitals no worse than baseline, axe clean. The owner
   signs the look.

## 6. Sample token set (this PR)

New tokens are namespaced `--ds-*`, so they add to the existing tokens and
override none.

| Token | Light | Dark | Tailwind utility |
|---|---|---|---|
| `--ds-rank-up` | `142.1 76.2% 36.3%` (= green-600) | `141.9 69.2% 58%` (= green-400) | `text-ds-rank-up` |
| `--ds-rank-down` | `0 72.2% 50.6%` (= red-600) | `0 90.6% 70.8%` (= red-400) | `text-ds-rank-down` |
| `--ds-rank-steady` | `220 8.9% 46.1%` (= gray-500) | `217.9 10.6% 64.9%` (= gray-400) | `text-ds-rank-steady` |
| `--ds-space-inline` | `0.25rem` | — | `gap-ds-inline` (and other spacing utilities) |
| `--ds-radius-chip` | `9999px` | — | `rounded-ds-chip` |
| `--ds-font-size-delta` | `var(--font-size-sm)` | — | `text-ds-delta` |

`components/ui/ranking-change.tsx` now renders from the colour and spacing
tokens. It replaced `text-green-600 dark:text-green-400`,
`text-red-600 dark:text-red-400`, `text-gray-500 dark:text-gray-400` and
`gap-1`. Each colour token converts to the same hex as the palette class it
replaced, light and dark, and `gap-1` was already `0.25rem`, so no page
changes visibly. The radius and type tokens are mapped but not yet used.

`tests/unit/design-tokens-178.test.ts` proves the path: Tailwind with the repo
config emits each `--ds-*` utility, `RankingChange` renders the token
utilities in all four states, and each colour token matches its palette hex.
