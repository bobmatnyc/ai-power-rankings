# Prompt: design-system tokens (M4-1, #188)

The prompt for the token layer, and the rubric its output was checked
against. Under D75 the "headless design agent" is a local Claude Code session
on the maintainer's Mac under the existing Claude login: no API key, no
`--max-budget-usd`, no push. The run that produced the committed layer was an
interactive session given this prompt; a repeat run can pass the same text to
`claude -p "$(cat docs/refresh/prompts/tokens.md)"` with the allowlist in
`docs/refresh/design-agent-spike.md` section 1, minus the budget flag.

## Prompt

> You are adding the design-system token layer for AI Power Rankings
> (Next.js 15, Tailwind 3.4). Work only in this worktree. Do not push, install
> packages or fetch from the network.
>
> **Read first:** `app/globals.css` (the existing shadcn variables and the
> #178 `--ds-*` tokens), `tailwind.config.js`, `components/ui/*`,
> `lib/ranking-utils.ts`, `docs/refresh/design-agent-spike.md`, and the audit in
> `docs/refresh/design-audit/` (token inventory, one-off colour list, and the
> screenshots under `tmp/design-audit/before/` if present).
>
> **Write** a new `--ds-*` layer in `app/globals.css`, between
> `/* #188 design-system tokens BEGIN` and `/* #188 design-system tokens END`
> markers, after the existing variable blocks:
>
> 1. Colour, as HSL components (`H S% L%`) in the existing style, with a light
>    value on `:root` and a dark value on `.dark`: surface (page, raised,
>    muted, inverse), text (default, muted, inverse), border (default, strong,
>    focus ring), accent (default, hover, foreground, subtle), status
>    (success, warning, danger, info, each with a `-subtle` background), and
>    score bands for the S–D tiers with one foreground.
> 2. Type scale (size roles, heading and body line height, weights), spacing
>    (a t-shirt scale plus gutter and section), radius (control, card, panel),
>    shadow (a colour and three elevations, declared in both modes) and motion
>    (three durations, three easings, zero durations under reduced motion).
>    Mode-invariant tokens go on `:root, .dark`.
> 3. Name tokens by role (`--ds-surface`, `--ds-text-muted`), not as aliases
>    of the shadcn variables. Values may reference existing variables with
>    `var()`.
> 4. Keep the #178 tokens (`--ds-rank-*`, `--ds-space-inline`,
>    `--ds-radius-chip`, `--ds-font-size-delta`) exactly where and as they are.
>
> Map every new token in `tailwind.config.js` under the `ds` key
> (`colors.ds`, `fontSize`, `spacing`, `borderRadius`, `boxShadow`,
> `transitionDuration`, …) as `hsl(var(--ds-…))` for colours and
> `var(--ds-…)` otherwise.
>
> **Do not** change any existing variable value, class, or component. Live
> pages must render pixel-identically. Do not edit `public/globals.css`.
>
> **Check** your work with `npx vitest run tests/unit/design-tokens-188.test.ts
> tests/unit/design-tokens-178.test.ts` and `npx tsc --noEmit`, then document
> the tokens, their contrast ratios and the component API for #190 in
> `docs/refresh/design-tokens.md`.

## Rubric (proposal section 2(a), as applied to #188)

| # | Criterion | How it is checked |
|---|---|---|
| 1 | Token file exists in the repo | Layer markers in `app/globals.css`; `tokenLayer()` throws without them |
| 2 | Covers colour (surface, text, border, accent, status, score bands), type scale, spacing, radius, shadow, motion | Test: each category has tokens in `:root` and `.dark` |
| 3 | Dark mode for every colour | Test: the set of colour tokens is the same in both modes |
| 4 | No hard-coded colours in the new layer | Test: no hex and no `rgb(` in the layer (comments stripped); every colour value matches `H S% L%` |
| 5 | Mapped in the Tailwind theme | Test: Tailwind with the repo config emits a `ds` utility for every token |
| 6 | WCAG AA text contrast | Test: every pair in `AA_PAIRS` is at least 4.5:1 in both modes; ratios in `docs/refresh/design-tokens.md` |
| 7 | Additive; #178 intact | Test: the layer declares only `--ds-*` names, none of them #178 names, and the #178 values are unchanged; screenshots before and after compared per file |
| 8 | Owner approves the look | `tmp/design-swatches.html` from `scripts/build-design-swatches.ts`; `/design` follows in #190 |

Score each row pass or fail. A fail on rows 1–7 blocks the PR; row 8 blocks
the merge until the owner signs off.
