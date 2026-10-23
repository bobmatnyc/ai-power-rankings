# Core-component colour migration (#190 PR B)

Hard-coded colours in the core components move to `--ds-*` tokens that
render the same colour in light and dark mode. Nothing on the page changes.
The ratchet in `tests/unit/globals-consolidation-189.test.ts` drops from 791
to 708: 83 of the 111 uses in scope move; the 28 gradient stops stay (see
"Not migrated").

The semantic tokens from #188 (`--ds-text-muted`, `--ds-success`, …) switch
value with `.dark`. These components do not switch today: `text-gray-600`
is gray-600 in both modes. So each class maps to a new **fixed** token that
holds one Tailwind palette colour in both modes, written as HSL precise to
1e-7 of a channel. Only the status indicator had `dark:` variants; its two
tokens keep both values.

## Mapping

Resolved values are the rendered sRGB colour, light / dark.

| Old class | Token utility | Light | Dark | Files (uses) |
|---|---|---|---|---|
| `bg-gray-900` | `bg-ds-surface-footer` | `#111827` | `#111827` | footer (1) |
| `text-gray-300` | `text-ds-text-footer` | `#d1d5db` | `#d1d5db` | footer (1) |
| `text-white`, `hover:text-white` | `text-ds-text-on-fill`, `hover:text-ds-text-on-fill` | `#ffffff` | `#ffffff` | footer (21), tier legend (5), tool icon (2), `[lang]/page` (1) |
| `bg-gray-700` | `bg-ds-border-footer` | `#374151` | `#374151` | footer separator (1) |
| `bg-gray-50` | `bg-ds-surface-paper-muted` | `#f9fafb` | `#f9fafb` | markdown layout (1) |
| `bg-white` | `bg-ds-surface-paper` | `#ffffff` | `#ffffff` | markdown layout (1), error boundary (2) |
| `bg-gray-100` | `bg-ds-surface-paper-sunken` | `#f3f4f6` | `#f3f4f6` | error boundary (1), `[lang]/page` (1), `[lang]/layout` (1) |
| `text-gray-600` | `text-ds-text-paper-muted` | `#4b5563` | `#4b5563` | `[lang]/page` (1), `[lang]/layout` (1) |
| `bg-gray-200` | `bg-ds-surface-skeleton` | `#e5e7eb` | `#e5e7eb` | rankings grid (4), client-rankings (3), client-rankings-optimized (7) |
| `bg-black/80`, `bg-black/50` | `bg-ds-surface-overlay/80`, `/50` | `#000000` | `#000000` | dialog (1), alert-dialog (1), sidebar (1) |
| `text-orange-600` | `text-ds-warning-fixed` | `#ea580c` | `#ea580c` | rankings content (1) |
| `text-green-600` | `text-ds-success-fixed` | `#16a34a` | `#16a34a` | rankings content (1), comparison table (1) |
| `text-red-600` | `text-ds-danger-fixed` | `#dc2626` | `#dc2626` | rankings content (1), `[lang]/page` (1), `[lang]/layout` (1) |
| `text-red-400` | `text-ds-danger-fixed-soft` | `#f87171` | `#f87171` | comparison table (1) |
| `text-blue-600` | `text-ds-accent-fixed` | `#2563eb` | `#2563eb` | rankings content (1), `[lang]/page` (1) |
| `bg-green-500` | `bg-ds-success-solid` | `#22c55e` | `#22c55e` | status indicator (1) |
| `bg-yellow-500` | `bg-ds-warning-solid` | `#eab308` | `#eab308` | status indicator (1) |
| `bg-orange-500` | `bg-ds-warning-solid-strong` | `#f97316` | `#f97316` | status indicator (1) |
| `bg-red-500` | `bg-ds-danger-solid` | `#ef4444` | `#ef4444` | status indicator (1) |
| `bg-blue-500` | `bg-ds-info-solid` | `#3b82f6` | `#3b82f6` | status indicator (1) |
| `bg-gray-900 dark:bg-gray-800` | `bg-ds-surface-signal` | `#111827` | `#1f2937` | status indicator (2) |
| `bg-gray-600 dark:bg-gray-700` | `bg-ds-surface-signal-off` | `#4b5563` | `#374151` | status indicator (6) |
| `bg-green-500`, `bg-blue-500`, `bg-purple-500` | `bg-ds-accent-cat-green`, `-blue`, `-purple` | `#22c55e`, `#3b82f6`, `#a855f7` | same | `[lang]/page` dots (3) |

83 uses in 16 files. A `dark:` variant counts as its own use, so the status
indicator's 3 × `bg-gray-600 dark:bg-gray-700` are 6.

The overlay is the one token mapped with `/ <alpha-value>` in
`tailwind.config.js`, so it takes an opacity modifier.

## Not migrated

| Uses | Where | Reason |
|---|---|---|
| 18 | `components/ui/tool-icon.tsx`: `from-<hue>-500 to-<hue>-600` for blue, purple, green, orange, pink, indigo, teal, red, gray | Gradient stops. Chromium interpolates a gradient from the unrounded colour and dithers it, so an HSL token that is 1e-7 of a channel away from the palette hex still moves pixels. With tokens, `/design` dark at 375 px had 4 pixels of the teal icon off by one in blue (`17,169,154` → `17,169,153`); with the classes restored it is pixel-identical. |
| 10 | `components/ranking/tier-legend.tsx`: `from-yellow-500 to-amber-500`, `from-blue-500 to-indigo-500`, `from-green-500 to-emerald-500`, `from-gray-500 to-slate-500`, `from-orange-500 to-red-500` | Same reason. |

A gradient token needs an exact value, which the HSL-only rule in the #188
layer cannot express, or an approved visible change (for example the tier
legend moving to the `--ds-score-*` bands).

## Contrast below AA that this keeps

Parity keeps today's colours, including these pairs below 4.5:1. They are
not in `AA_PAIRS`; changing them is a visible change for the owner.

| Pair | Ratio |
|---|---|
| `--ds-text-on-fill` (white) on the tier S gradient, yellow-500 / amber-500 | 1.92 / 2.15 |
| `--ds-text-on-fill` on the tier B and D gradient starts, green-500 / orange-500 | 2.28 / 2.80 |
| `--ds-text-on-fill` on the green, orange and teal tool icons (500 stop) | 2.28 / 2.80 / 2.49 |

PR C1 removed the `--ds-success-fixed` and `--ds-warning-fixed` rows; see
below. The remaining rows are gradient fills, left for PR C2.

## PR C1: accessibility fixes (visible)

PR C1 is the first #190 change that alters pixels. The owner approves it
from before/after screenshots.

| Change | Pair | Before | After |
|---|---|---|---|
| `--ds-rank-up` light: green-600 to green-700 (`--ds-success` value) | on `--ds-surface` and `--ds-surface-raised` (white) | 3.30 | 5.02 |
| `--ds-success-fixed`: green-600 to green-700 | on white | 3.30 | 5.02 |
| `--ds-warning-fixed`: orange-600 to orange-700 | on white | 3.56 | 5.18 |
| `--ds-border-strong` light: slate-300 to `215 16.3% 56%` (`#7d8ca1`) | on surface / raised / muted | 1.48 / 1.48 / 1.36 | 3.42 / 3.42 / 3.12 |
| `--ds-border-strong` dark: slate-600 to slate-500 | on surface / raised / muted | 2.64 / 2.36 / 1.93 | 4.20 / 3.75 / 3.07 |
| `destructive` colour added, `--ds-danger` | text on light / dark surface | none (no CSS) | 6.47 / 7.23 |
| `destructive-foreground`, `--ds-surface` | on a `bg-destructive` fill, light / dark | none (no CSS) | 6.47 / 7.23 |

- **Destructive.** `tailwind.config.js` had no `destructive` colour, so the
  8 `text-`/`bg-`/`border-destructive` sites (6 files) emitted no CSS:
  destructive Alerts, the home autonomous-agent card, the error boundary
  icon and the confirm-dialog button rendered without red. They now
  resolve to `--ds-danger`. `tests/unit/tailwind-colour-classes-190.test.ts`
  fails when a `text-`, `bg-` or `border-` class in source compiles to nothing.
- **Borders.** `--ds-border` stays below 3:1 as a documented decorative
  exception: it draws dividers and card edges, never the only edge of a
  control. Form controls move from `border-input` (the same value as
  `--ds-border`, 1.23 light) to `border-ds-border-strong`: Input, Select
  trigger, Textarea, the admin tools-manager and news selects, the subscribe
  checkbox, and the outline button (`components/ui/button.tsx` and the two
  about-page HTML buttons). 10 sites.
- **Modifier text in dark mode (resolved).** The rankings table and the
  comparison table show success/warning text on a card that is white in
  light mode and `#020817` in dark mode. A one-value `-fixed` token cannot
  pass on both: the 700 step fell to 3.99 (green) and 3.86 (orange) in dark
  mode. The three sites (`rankings-content.tsx` decay and positive risk,
  `comparison-table.tsx` tick) now use the mode-dependent `--ds-success` and
  `--ds-warning`. On the card, light / dark:

  | Site text | Before C1 | After |
  |---|---|---|
  | success (was `--ds-success-fixed`, green-600) | 3.30 / 6.07 | 5.02 / 11.48 |
  | warning (was `--ds-warning-fixed`, orange-600) | 3.56 / 5.62 | 5.02 / 11.98 |

  On the row hover (`--ds-surface-muted`, the worst case) both are 4.58
  light; dark is 8.40 (success) and 8.76 (warning), up from 4.44 and 4.11.
  The light warning hue moves from orange-600 to amber-700, and the dark ones
  to green-400 and amber-400. `tests/unit/modifier-text-contrast-190.test.ts`
  checks every `text-ds-success*` / `text-ds-warning*` class in both files
  against the surface, raised and muted tokens in both modes.
  `--ds-success-fixed` and `--ds-warning-fixed` have no remaining use; they
  stay at the 700 values and in `AA_PAIRS` on white.
- **`/design`.** Answers 404 in production unless `DESIGN_PREVIEW` is set
  (non-empty) at build time; it keeps its `noindex` metadata. Dev, local and
  visual-test runs render it. It gains Alert, form-control and modifier-text
  samples.
- Ratchet: 708 to 707 (the subscribe checkbox's `border-gray-300`).

## How parity was checked

- Per mapping: each old class and its token class rendered at the same
  position in Chromium, light and `.dark`, compared byte for byte; a second
  render of the old class was the control. HSL rounded to 0.0005 of a
  channel made 14 gradients differ, so solid values carry eight digits.
- `/design` snapshots (`npm run test:visual`), zero tolerance, no baseline
  update.
- `scripts/design-audit-shots.ts` `before` and `before2` at the base commit,
  `after` and `after2` with this change, 54 shots each.
