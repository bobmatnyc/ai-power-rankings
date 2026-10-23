# Design-system tokens (M4-1, #188)

The `--ds-*` token layer is the source of truth for colour, type, spacing,
radius, shadow and motion in the refreshed UI. It lives in `app/globals.css`
between the `#188 design-system tokens BEGIN` and `END` markers and is mapped
in `tailwind.config.js` under the `ds` key. There is no `tokens.json`.

The layer is additive. No component uses it yet, and it changes no existing
variable or class, so live pages render as before. #189 migrates the
hard-coded colours onto it ([one-off list](design-audit/one-off-styles.md));
#190 builds the components and the `/design` page on it.

Contributor guide, `/design` page and checks: [design-system.md](design-system.md).

Inputs: [token inventory](design-audit/token-inventory.md), [one-off
styles](design-audit/one-off-styles.md), the screenshots described in
[design-audit/README.md](design-audit/README.md), and the prompt and rubric in
[prompts/tokens.md](prompts/tokens.md).

## How to use a token

- Colours are HSL components. Use them through Tailwind (`bg-ds-surface`,
  `text-ds-text-muted`, `border-ds-border`) or in CSS as
  `hsl(var(--ds-surface))`. For transparency, write
  `hsl(var(--ds-accent) / 0.1)` in CSS; the Tailwind mapping has no
  `<alpha-value>`, so `bg-ds-accent/10` does not work (the same holds for the
  existing shadcn colours).
- Light values sit on `:root`, dark values on `.dark`. Type, spacing, radius
  and motion do not change with the mode and are declared once on
  `:root, .dark`.
- Pair text and surface tokens as in the contrast table below. Each listed
  pair meets WCAG AA for normal text in both modes, and
  `tests/unit/design-tokens-188.test.ts` fails if a value change breaks one.

## Colour

| Token | Light | Dark | Tailwind | Role |
|---|---|---|---|---|
| `--ds-surface` | `0 0% 100%` | `222.2 84% 4.9%` | `bg-ds-surface` | Page background |
| `--ds-surface-raised` | `0 0% 100%` | `222.2 47.4% 11.2%` | `bg-ds-surface-raised` | Cards, popovers |
| `--ds-surface-muted` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | `bg-ds-surface-muted` | Table stripes, wells, skeletons |
| `--ds-surface-inverse` | `222.2 84% 4.9%` | `210 40% 98%` | `bg-ds-surface-inverse` | Tooltips, toasts |
| `--ds-text` | `222.2 84% 4.9%` | `210 40% 98%` | `text-ds-text` | Body and headings |
| `--ds-text-muted` | `215.3 19.3% 34.5%` | `215 20.2% 65.1%` | `text-ds-text-muted` | Secondary text, captions |
| `--ds-text-inverse` | `210 40% 98%` | `222.2 84% 4.9%` | `text-ds-text-inverse` | Text on `--ds-surface-inverse` |
| `--ds-border` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | `border-ds-border` | Dividers, card edges (decorative, below 3:1) |
| `--ds-border-strong` | `215 16.3% 56%` | `215 16.3% 46.9%` | `border-ds-border-strong` | Form-control edges (3:1 on every surface, #190 PR C1) |
| `--ds-focus-ring` | `221.2 83.2% 53.3%` | `213.1 93.9% 67.8%` | `ring-ds-focus-ring` | Focus outline |
| `--ds-accent` | `221.2 83.2% 53.3%` | `213.1 93.9% 67.8%` | `bg-ds-accent`, `text-ds-accent` | Links, primary buttons |
| `--ds-accent-hover` | `224.3 76.3% 48%` | `211.7 96.4% 78.4%` | `bg-ds-accent-hover` | Hover/active of the above |
| `--ds-accent-fg` | `0 0% 100%` | `222.2 84% 4.9%` | `text-ds-accent-fg` | Text on accent |
| `--ds-accent-subtle` | `214.3 100% 96.9%` | `224.4 64.3% 32.9%` | `bg-ds-accent-subtle` | Selected rows, info callouts |
| `--ds-success` | `142.4 71.8% 29.2%` | `141.9 69.2% 58%` | `text-ds-success` | Positive values, "live" |
| `--ds-success-subtle` | `138.5 76.5% 96.7%` | `144.9 80.4% 10%` | `bg-ds-success-subtle` | Success callout background |
| `--ds-warning` | `26 90.5% 37.1%` | `43.3 96.4% 56.3%` | `text-ds-warning` | Caution |
| `--ds-warning-subtle` | `48 100% 96.1%` | `20.5 91.7% 14.1%` | `bg-ds-warning-subtle` | Warning callout background |
| `--ds-danger` | `0 73.7% 41.8%` | `0 90.6% 70.8%` | `text-ds-danger` | Errors, destructive actions |
| `--ds-danger-subtle` | `0 85.7% 97.3%` | `0 74.7% 15.5%` | `bg-ds-danger-subtle` | Error callout background |
| `--ds-info` | `201.3 96.3% 32.2%` | `198.4 93.2% 59.6%` | `text-ds-info` | Neutral notices |
| `--ds-info-subtle` | `204 100% 97.1%` | `204 80.2% 15.9%` | `bg-ds-info-subtle` | Info callout background |
| `--ds-score-s` … `-d` | amber-700, blue-700, green-700, slate-600, red-700 | amber-400, blue-400, green-400, slate-400, red-400 | `bg-ds-score-s` … | Tier badges S–D (`lib/ranking-utils.ts`) |
| `--ds-score-fg` | `0 0% 100%` | `222.2 84% 4.9%` | `text-ds-score-fg` | Text on a tier badge |
| `--ds-rank-up/down/steady` (#178) | green-700 (#190 PR C1; was green-600), red-600, gray-500 | green-400, red-400, gray-400 | `text-ds-rank-up` … | Rank movement |

Status colours are text colours first: each passes AA as text on
`--ds-surface` and on its own `-subtle` background, so a callout is
`bg-ds-success-subtle text-ds-success`. Tier badges are solid
(`bg-ds-score-a text-ds-score-fg`); in dark mode they turn into light badges
with dark text.

The palette follows the existing shadcn/Tailwind slate and blue family. Two
values move away from it on purpose: `--ds-accent` is blue-600, not the
current `--primary` (white on `--primary` is 3.76:1), and `--ds-text-muted` is
slate-600 in light mode, not slate-500 (`--muted-foreground` on `--muted` is
4.34:1).

### Fixed colours (#190 PR B)

Components that look the same in both modes today (footer, tier-legend and
tool-icon text, status indicator, skeletons, error fallbacks, dialog overlays) use
fixed tokens: one Tailwind palette colour in both modes, declared in a
`:root, .dark` rule. They are `--ds-surface-{overlay, footer, skeleton,
paper, paper-muted, paper-sunken}`, `--ds-text-{on-fill, footer,
paper-muted}`, `--ds-border-footer`, `--ds-accent-fixed`,
`--ds-accent-cat-{green, blue, purple}` (decorative dots), `--ds-{success,
warning, danger, info}-solid`, `--ds-warning-solid-strong`, `--ds-{success,
warning, danger}-fixed` and `--ds-danger-fixed-soft`. `--ds-surface-signal`
and `--ds-surface-signal-off`
(status indicator) keep a light and a dark value. Gradients stay on palette
classes for now (see the map). Values, the class each one replaced, and the
contrast pairs below AA they keep:
[design-audit/migration-190b.md](design-audit/migration-190b.md).

## Contrast (WCAG 2.x, AA = 4.5:1)

Computed from the token values by `contrast()` in `scripts/design-tokens.ts`;
the test asserts each pair is at least 4.5.

| Foreground | Background | Light | Dark |
|---|---|---|---|
| `--ds-text` | `--ds-surface` | 20.01 | 19.12 |
| `--ds-text` | `--ds-surface-raised` | 20.01 | 17.06 |
| `--ds-text` | `--ds-surface-muted` | 18.26 | 13.98 |
| `--ds-text-muted` | `--ds-surface` | 7.58 | 7.80 |
| `--ds-text-muted` | `--ds-surface-raised` | 7.58 | 6.96 |
| `--ds-text-muted` | `--ds-surface-muted` | 6.92 | 5.71 |
| `--ds-text-inverse` | `--ds-surface-inverse` | 19.12 | 19.12 |
| `--ds-accent` | `--ds-surface` | 5.17 | 7.87 |
| `--ds-accent-fg` | `--ds-accent` | 5.17 | 7.87 |
| `--ds-accent-fg` | `--ds-accent-hover` | 6.70 | 11.09 |
| `--ds-text` | `--ds-accent-subtle` | 18.38 | 9.90 |
| `--ds-success` | `--ds-surface` | 5.02 | 11.48 |
| `--ds-success` | `--ds-success-subtle` | 4.79 | 8.55 |
| `--ds-warning` | `--ds-surface` | 5.02 | 11.98 |
| `--ds-warning` | `--ds-warning-subtle` | 4.84 | 8.97 |
| `--ds-danger` | `--ds-surface` | 6.47 | 7.23 |
| `--ds-danger` | `--ds-danger-subtle` | 5.91 | 5.84 |
| `--ds-info` | `--ds-surface` | 5.93 | 9.34 |
| `--ds-info` | `--ds-info-subtle` | 5.57 | 6.48 |
| `--ds-score-fg` | `--ds-score-s` | 5.02 | 11.98 |
| `--ds-score-fg` | `--ds-score-a` | 6.70 | 7.87 |
| `--ds-score-fg` | `--ds-score-b` | 5.02 | 11.48 |
| `--ds-score-fg` | `--ds-score-c` | 7.58 | 7.80 |
| `--ds-score-fg` | `--ds-score-d` | 6.47 | 7.23 |
| `--ds-text-footer` | `--ds-surface-footer` | 12.04 | 12.04 |
| `--ds-text-on-fill` | `--ds-surface-footer` | 17.74 | 17.74 |
| `--ds-success-fixed` | `--ds-surface-paper` (white) | 5.02 | 5.02 |
| `--ds-warning-fixed` | `--ds-surface-paper` (white) | 5.18 | 5.18 |
| `--ds-surface` (`destructive-foreground`) | `--ds-danger` (`destructive`) | 6.47 | 7.23 |

The #178 rank tokens live outside this layer; `tests/unit/design-tokens-178.test.ts`
checks them on `--ds-surface` and `--ds-surface-raised`. On `--ds-surface`,
`--ds-rank-up` is 5.02 light / 11.48 dark, `--ds-rank-down` 4.83 / 7.23,
`--ds-rank-steady` 4.83 / 7.88. #190 PR C1 moved light `--ds-rank-up` from
green-600 (3.30:1) to green-700 (`142.4 71.8% 29.2%`, the `--ds-success`
value).

Non-text pairs (WCAG 1.4.11, 3:1) are checked by
`tests/unit/design-contrast-190.test.ts`. `--ds-border-strong` meets 3:1 on
every surface in both modes (light 3.42 / 3.42 / 3.12, dark 4.20 / 3.75 /
3.07 on surface / raised / muted). `--ds-border` stays below 3:1 as a
decorative exception: it never draws the only edge of a control.

`destructive` in `tailwind.config.js` (#190 PR C1) is an alias:
`destructive` is `--ds-danger`, `destructive-foreground` is `--ds-surface`.

## Type scale

| Token | Value | Tailwind |
|---|---|---|
| `--ds-font-size-caption` | `var(--font-size-xs)` (12–14px fluid) | `text-ds-caption` |
| `--ds-font-size-body-sm` | `var(--font-size-sm)` | `text-ds-body-sm` |
| `--ds-font-size-body` | `var(--font-size-base)` | `text-ds-body` |
| `--ds-font-size-lead` | `var(--font-size-lg)` | `text-ds-lead` |
| `--ds-font-size-h4` | `var(--font-size-xl)` | `text-ds-h4` |
| `--ds-font-size-h3` | `var(--font-size-2xl)` | `text-ds-h3` |
| `--ds-font-size-h2` | `var(--font-size-3xl)` | `text-ds-h2` |
| `--ds-font-size-h1` | `var(--font-size-4xl)` | `text-ds-h1` |
| `--ds-font-size-display` | `var(--font-size-5xl)` | `text-ds-display` |
| `--ds-line-height-heading` / `-body` | `1.1` / `1.65` | `leading-ds-heading` / `leading-ds-body` |
| `--ds-font-weight-body` / `-label` / `-heading` | 400 / 500 / 700 | `font-ds-body` / `font-ds-label` / `font-ds-heading` |

Sizes are roles on the existing fluid `clamp()` scale, so a role can move to a
different step without touching components.

## Spacing

| Token | Value | Tailwind |
|---|---|---|
| `--ds-space-xs` | 0.25rem | `p-ds-xs`, `gap-ds-xs`, … |
| `--ds-space-sm` | 0.5rem | `p-ds-sm` |
| `--ds-space-md` | 1rem | `p-ds-md` |
| `--ds-space-lg` | 1.5rem | `p-ds-lg` (card padding today: `p-6`) |
| `--ds-space-xl` | 2rem | `p-ds-xl` |
| `--ds-space-2xl` | 3rem | `p-ds-2xl` |
| `--ds-space-gutter` | 1rem | `px-ds-gutter` (page side padding) |
| `--ds-space-section` | 4rem | `py-ds-section` (between page sections) |
| `--ds-space-inline` (#178) | 0.25rem | `gap-ds-inline` |

## Radius

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `--ds-radius-control` | 0.375rem | `rounded-ds-control` | Buttons, inputs, selects |
| `--ds-radius-card` | 0.5rem | `rounded-ds-card` | Cards, table wrappers |
| `--ds-radius-panel` | 0.75rem | `rounded-ds-panel` | Dialogs, sheets, hero panels |
| `--ds-radius-chip` (#178) | 9999px | `rounded-ds-chip` | Badges, pills, avatars |

## Shadow

| Token | Light | Dark | Tailwind |
|---|---|---|---|
| `--ds-shadow-color` | `222.2 84% 4.9%` | `0 0% 0%` | — |
| `--ds-shadow-sm` | 1px, 6 % | 1px, 30 % | `shadow-ds-sm` |
| `--ds-shadow-md` | 4px + 2px, 10 % | 40 % | `shadow-ds-md` |
| `--ds-shadow-lg` | 10px + 4px, 10 % | 50 % | `shadow-ds-lg` |

Each shadow is declared in both modes because a custom property that uses
`var()` resolves where it is declared; a `.dark` subtree would otherwise
inherit the light shadow.

## Motion

| Token | Value | Tailwind |
|---|---|---|
| `--ds-duration-fast` / `-base` / `-slow` | 150 / 250 / 350ms | `duration-ds-fast` … |
| `--ds-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | `ease-ds-standard` |
| `--ds-ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` | `ease-ds-enter` |
| `--ds-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | `ease-ds-exit` |

Under `prefers-reduced-motion: reduce` the three durations become `0ms`.

## Component API notes for #190

Components in `components/ui/` read only `--ds-*` tokens (through the `ds`
Tailwind utilities) and never palette classes or hex. Suggested surface:

| Component | Props | Tokens |
|---|---|---|
| `Surface` / `Card` | `elevation: "flat" \| "raised"`, `padding: "md" \| "lg"` | `bg-ds-surface-raised`, `border-ds-border`, `rounded-ds-card`, `shadow-ds-sm`, `p-ds-lg` |
| `Button` | `variant: "primary" \| "secondary" \| "ghost" \| "danger"`, `size: "sm" \| "md"` | `bg-ds-accent text-ds-accent-fg hover:bg-ds-accent-hover`, `rounded-ds-control`, `ring-ds-focus-ring`, `duration-ds-fast` |
| `Badge` | `tone: "neutral" \| "success" \| "warning" \| "danger" \| "info"` | `bg-ds-<tone>-subtle text-ds-<tone>`, `rounded-ds-chip`, `text-ds-caption`, `font-ds-label` |
| `TierBadge` | `tier: "S" \| "A" \| "B" \| "C" \| "D"` | `bg-ds-score-<tier> text-ds-score-fg`; replaces `getTierColor()` |
| `RankDelta` | `previousRank?`, `currentRank` | today's `RankingChange` (#178 tokens) |
| `Callout` | `tone`, `title?` | `bg-ds-<tone>-subtle`, `text-ds-text`, icon in `text-ds-<tone>` |
| `Heading` | `level: 1–4`, `as?` | `text-ds-h<level>`, `leading-ds-heading`, `font-ds-heading` |
| `Text` | `size: "body" \| "body-sm" \| "caption" \| "lead"`, `muted?` | `text-ds-<size>`, `text-ds-text` / `text-ds-text-muted` |
| `Stack` / `Section` | `gap`, `as?` | `gap-ds-*`, `py-ds-section`, `px-ds-gutter` |

Rules for #190:

1. A component exposes semantic props (`tone`, `elevation`), never a colour
   name.
2. Every interactive component shows `--ds-focus-ring` on `:focus-visible`.
3. Transitions use `--ds-duration-*` and `--ds-ease-*`, so reduced motion
   applies everywhere.
4. Dark mode needs no `dark:` variants: the tokens switch with the `.dark`
   class. The site has no toggle yet; adding one is a #190 decision.
5. A new token goes into the layer with light and dark values, a Tailwind
   mapping, and, for a text/surface pair, a row in `AA_PAIRS`
   (`scripts/design-tokens.ts`). The test enforces all three.

## Swatch page

`npx tsx scripts/build-design-swatches.ts` writes `tmp/design-swatches.html`
(gitignored). Open it in a browser: light and dark panels side by side, every
colour with its HSL and hex value, each contrast pair rendered with its ratio,
and the type, spacing, radius, shadow and motion tokens. It reads the same
parser as the test, so it shows exactly the committed tokens.
