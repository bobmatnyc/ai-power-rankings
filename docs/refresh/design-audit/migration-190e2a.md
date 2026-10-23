# Admin components and SEO dashboard colour migration (#190 PR E2a)

Hard-coded colours in the admin components and the SEO dashboard move to
existing `--ds-*` tokens. Nothing on the page changes. No token is added. The
ratchet in `tests/unit/globals-consolidation-189.test.ts` drops from 390 to
264: 126 of the 181 uses in the 12 files below. The other 55 have no token
with the exact colour and stay (see "Not migrated").

Admin pages need a signed-in admin and live data, so they cannot be
screenshotted. Ruling D1 replaces page screenshots with a class-diff check,
plus `/design` stories (see "`/design` stories" below). The mapping lives in
one table, `scripts/design-class-maps.ts` (set `190e2a`), which the class-diff
check, the pixel check and the unit test all read.

## Files

| File | Uses | Migrated | Left |
|---|---|---|---|
| `components/admin/generation-stats.tsx` | 60 | 36 | 24 |
| `components/admin/unified-admin-dashboard.tsx` | 25 | 19 | 6 |
| `components/admin/rankings-viewer.tsx` | 22 | 8 | 14 |
| `components/admin/news-ingestion-tool.tsx` | 19 | 15 | 4 |
| `components/admin/admin-dashboard.tsx` | 11 | 9 | 2 |
| `components/admin/rankings-manager.tsx` | 10 | 10 | 0 |
| `components/admin/article-management.tsx` | 7 | 6 | 1 |
| `components/admin/character-counter.tsx` | 6 | 4 | 2 |
| `components/admin/back-to-website-nav.tsx` | 5 | 5 | 0 |
| `components/admin/tools-manager.tsx` | 5 | 4 | 1 |
| `components/admin/image-uploader.tsx` | 2 | 2 | 0 |
| `components/seo/seo-dashboard.tsx` | 9 | 8 | 1 |

## Mapping

Resolved values are the rendered sRGB colour, light / dark. Each old colour
has one target. A variant prefix (`hover:`) and an opacity modifier (`/50`)
carry over. A `dark:` variant counts as its own use.

| Old class or inline hex | Token | Light | Dark | Uses |
|---|---|---|---|---|
| `text-gray-600` | `text-ds-text-paper-muted` | `#4b5563` | `#4b5563` | 22 |
| `text-gray-500` | `text-ds-text-paper-subtle` | `#6b7280` | `#6b7280` | 13 |
| `text-gray-400` | `text-ds-text-paper-faint` | `#9ca3af` | `#9ca3af` | 1 |
| `bg-white` | `bg-ds-surface-paper` | `#ffffff` | `#ffffff` | 3 |
| `bg-gray-50`, `hover:bg-gray-50` | `bg-ds-surface-paper-muted` | `#f9fafb` | `#f9fafb` | 3 |
| `bg-gray-100`, `hover:bg-gray-100` | `bg-ds-surface-paper-sunken` | `#f3f4f6` | `#f3f4f6` | 2 |
| `bg-gray-200` (skeleton) | `bg-ds-surface-skeleton` | `#e5e7eb` | `#e5e7eb` | 3 |
| `border-gray-200` | `border-ds-border-paper` | `#e5e7eb` | `#e5e7eb` | 3 |
| `bg-black/50` | `bg-ds-surface-overlay/50` | `#000000` at 50 % | same | 3 |
| `text-white` | `text-ds-text-on-fill` | `#ffffff` | `#ffffff` | 1 |
| `text-green-500` | `text-ds-success-solid` | `#22c55e` | `#22c55e` | 1 |
| `bg-green-500` | `bg-ds-success-solid` | `#22c55e` | `#22c55e` | 1 |
| `text-green-600` | `text-ds-success-fixed-mid` | `#16a34a` | `#16a34a` | 11 |
| `text-green-700` | `text-ds-success-fixed` | `#15803d` | `#15803d` | 1 |
| `bg-green-50` | `bg-ds-success-fixed-subtle` | `#f0fdf4` | `#f0fdf4` | 6 |
| `border-green-200` | `border-ds-success-fixed-border` | `#bbf7d0` | `#bbf7d0` | 3 |
| `text-red-600` | `text-ds-danger-fixed` | `#dc2626` | `#dc2626` | 13 |
| `bg-red-500` | `bg-ds-danger-solid` | `#ef4444` | `#ef4444` | 1 |
| `bg-red-50` | `bg-ds-danger-fixed-subtle` | `#fef2f2` | `#fef2f2` | 7 |
| `border-red-200` | `border-ds-danger-fixed-border` | `#fecaca` | `#fecaca` | 3 |
| `text-red-600 dark:text-red-400` | `text-ds-text-callout-danger` | `#dc2626` | `#f87171` | 4 |
| `text-green-600 dark:text-green-400` | `text-ds-text-callout-success` | `#16a34a` | `#4ade80` | 2 |
| `text-blue-600` | `text-ds-accent-fixed` | `#2563eb` | `#2563eb` | 2 |
| `bg-blue-500` | `bg-ds-accent-cat-blue` | `#3b82f6` | `#3b82f6` | 1 |
| `text-yellow-500` | `text-ds-accent-cat-yellow` | `#eab308` | `#eab308` | 1 |
| `bg-yellow-500` | `bg-ds-accent-cat-yellow` | `#eab308` | `#eab308` | 2 |
| `text-yellow-600` | `text-ds-accent-cat-yellow-strong` | `#ca8a04` | `#ca8a04` | 2 |
| `bg-orange-500` | `bg-ds-accent-cat-orange` | `#f97316` | `#f97316` | 1 |
| `text-orange-600` | `text-ds-accent-cat-orange-strong` | `#ea580c` | `#ea580c` | 2 |
| `bg-purple-500` | `bg-ds-accent-cat-purple` | `#a855f7` | `#a855f7` | 1 |
| inline `#3b82f6` (db-status card edge) | `hsl(var(--ds-accent-cat-blue))` | `#3b82f6` | `#3b82f6` | 1 |
| inline `#ef4444` (db-status card edge) | `hsl(var(--ds-danger-solid))` | `#ef4444` | `#ef4444` | 1 |
| inline `#e5e7eb` (back-to-website bar border) | `hsl(var(--ds-border-paper))` | `#e5e7eb` | `#e5e7eb` | 1 |
| inline `#f0fdf4` (back-to-website bar) | `hsl(var(--ds-success-fixed-subtle))` | `#f0fdf4` | `#f0fdf4` | 1 |
| inline `#22c55e` (back-to-website link) | `hsl(var(--ds-success-solid))` | `#22c55e` | `#22c55e` | 2 |
| inline `#16a34a` (link, pointer over) | `hsl(var(--ds-success-fixed-mid))` | `#16a34a` | `#16a34a` | 1 |

- **Inline colours stay inline.** The db-status card picks its left-edge
  colour in a ternary, and the back-to-website link swaps its background in
  `onMouseEnter`/`onMouseLeave`. Moving those to classes would change code,
  which the class-diff check cannot prove. Each hex becomes its token's
  `hsl(var(--ds-…))` in the same style property, so the cascade is unchanged:
  an inline style still beats the global `a`, `a:hover` and `a:active` rules.
- **Links and buttons.** The rankings-viewer rows are `Link`s (`a`) and the
  article delete control is an outline `Button`. They change class to class
  with the same variants, so the global `a` and `button` rules treat old and
  new the same way. The pixel check renders them in an `a` and a `button` at
  rest, hover and active.
- **`dark:` pairs.** A light class with a `dark:` partner maps only as a
  pair, to a token that holds both values. The character counter's
  `text-orange-600 dark:text-orange-400` has no such token and stays whole.
  Mapping only its light class would render the same, but the class-diff
  check refuses it so a pair is never half migrated.
- **Same value, different role.** The admin-dashboard section tiles use
  `bg-ds-success-solid` for green-500 (as #190 E1 did for its dots), and the
  category accents for the other hues. One old class has one target.
- **Role.** A text class maps to a `--ds-text-*` token, a background class to
  a `--ds-surface-*` token, a border to a `--ds-border-*` token, or any of
  them to a role-neutral accent or status token. Gradient stops
  (`--ds-grad-*`) are not used for solid colours.

## Not migrated

No existing token holds these colours with the same light and dark values in
the same role. They stay as they are.

**Exempt under ruling Df8 (owner, 2026-10-23).** These 55 uses are exempt
from the colour ratchet. Each of the 9 files has its own entry in
`RATCHET_ALLOWLIST` (`tests/unit/globals-consolidation-189.test.ts`) with the
reason below and a `colourCap` at its current count, so adding a colour to
one of these files still fails the test. The baseline dropped from 205 to
150. No colour was mapped and no token was added.

| File | `colourCap` |
|---|---|
| `components/admin/generation-stats.tsx` | 24 |
| `components/admin/rankings-viewer.tsx` | 14 |
| `components/admin/unified-admin-dashboard.tsx` | 6 |
| `components/admin/news-ingestion-tool.tsx` | 4 |
| `components/admin/admin-dashboard.tsx` | 2 |
| `components/admin/character-counter.tsx` | 2 |
| `components/admin/article-management.tsx` | 1 |
| `components/admin/tools-manager.tsx` | 1 |
| `components/seo/seo-dashboard.tsx` | 1 |

| Uses | Where | Old | Value, light / dark | Nearest token and why it does not match |
|---|---|---|---|---|
| 8 | generation-stats stat tiles | `bg-blue-50`, `bg-purple-50`, `bg-orange-50`, `bg-cyan-50` | 50 step both | none |
| 9 | generation-stats tile values | `text-blue-900`, `text-purple-900`, `text-orange-900`, `text-cyan-900`, `text-green-900` | 900 step both | none |
| 6 | alerts (unified, news ingestion, rankings viewer), LIVE and change badges | `text-green-800` | `#166534` both | `--ds-text-tag-green` is `#166534` / `#86efac`; `--ds-grad-green-800` is a gradient stop |
| 4 | generation-stats error, news ingestion error, tools-manager alert, rankings-viewer badge | `text-red-800` | `#991b1b` both | none |
| 3 | generation-stats error, SEO error title, article delete hover | `text-red-700`, `hover:text-red-700` | `#b91c1c` both | `--ds-danger` is red-700 in light only; `--ds-text-callout-danger-title` is `#b91c1c` / `#fca5a5` |
| 1 | unified JSON status | `text-blue-700` | `#1d4ed8` both | `--ds-accent-hover`: light only |
| 1 | rankings-viewer badge | `text-blue-800` | `#1e40af` both | `--ds-text-tag-blue` is `#1e40af` / `#93c5fd` |
| 1 | unified "not configured" | `text-yellow-700` | `#a16207` both | none |
| 3 | generation-stats headings, unified database label | `text-gray-700` | `#374151` both | `--ds-border-footer`: a border token |
| 1 | generation-stats title | `text-gray-800` | `#1f2937` both | `--ds-surface-signal`: dark only, a surface token |
| 2 | generation-stats total and model count | `text-gray-900` | `#111827` both | `--ds-surface-footer`: a surface token |
| 2 | admin-dashboard disabled section tiles | `bg-gray-500` | `#6b7280` both | `--ds-text-paper-subtle`: a text token; `--ds-grad-gray-500`: a gradient stop |
| 5 | rankings-viewer badges | `bg-green-100` (3), `bg-red-100`, `bg-blue-100` | 100 step both | `--ds-surface-tag-*` switch to 900 at 30 % in dark |
| 4 | rankings-viewer top-3 rows, news-ingestion warnings | `bg-yellow-50`, `border-yellow-200` | 50 / 200 step both | none |
| 1 | rankings-viewer top-3 rows | `hover:border-yellow-300` | `#fde047` both | none |
| 2 | character counter, warning | `text-orange-600 dark:text-orange-400` | `#ea580c` / `#fb923c` | `--ds-accent-cat-orange-strong` is `#ea580c` in both modes |
| 1 | unified db-status edge, development | inline `#10b981` | emerald-500 both | none |
| 1 | unified db-status edge, unknown | inline `#6b7280` | gray-500 both | `--ds-text-paper-subtle`: a text token on a border |

## How parity was checked

- **Class diff (ruling D1).** `npx tsx scripts/design-class-diff.ts --set
  190e2a` compares each of the 12 files at `origin/main` with the working
  tree. Comments are ignored; every other change must be an old colour
  replaced by its table token, with the same variant prefix and opacity
  modifier. It fails on another token, a dropped `hover:` or `dark:`
  variant, a half-mapped `dark:` pair, a changed non-colour class or a code
  change. It passed with 0 unexplained changes and 123 substitutions (126
  uses; a pair is one substitution and two uses). A wrong token
  (`text-ds-text-paper-subtle` for `text-gray-600`) and a dropped variant
  (`hover:bg-gray-100` to `bg-ds-surface-paper-sunken`) each failed it. For
  E2b, add a set to `CLASS_MAPS`.
- **Unit test.** `tests/unit/design-parity-190e2a.test.ts`: each token's light
  and dark HSL equals the old colour's channels to 0.05 of a step, not only
  after rounding to hex; each token has the role of the class it replaces;
  `tailwind-merge` (`cn()`) drops the same conflicting classes for the token
  as for the old class, so a component's default `bg-card` or `border-input`
  still gives way; and the class-diff function passes and fails the cases
  above.
- **Pixels.** `scripts/design-parity-pixels.ts --set 190e2a` builds each
  mapping from the same table and renders it in the element it is used on
  (`div`, an `svg` icon in `currentColor`, the rankings-viewer row `a`, the
  delete `button`, the back-to-website `a`), with the repo's `app/globals.css`
  and Tailwind config, light and `.dark`, at rest, with the pointer over it
  and with the mouse button held down. No mapping is used on a form control.
  On full Chrome for Testing 153.0.8010.12 (Playwright build 1243, not the
  headless shell): 44 mappings, 268 mode/state rows, 0 pixels different, and
  every control render of the old form 0. The one-step control
  (`text-green-600` to `--ds-success-fixed`) differed by 932 / 943 pixels and
  the row link without its `hover:` variant by 4,963 / 4,969 on hover.
- **`/design` snapshots.** `npm run test:visual`, zero tolerance, no baseline
  update.

## `/design` stories

The #190 plan defines `/design` as the noindex route that renders every core
component and state in light and dark, snapshotted at three widths (PR A).
A "`/design` story" for D1 is therefore a section on that page that renders
the admin patterns with their token classes. Adding one grows the page and
changes all six `/design` baselines, so it needs `npm run test:visual --
--update-snapshots`. This PR does not change the baselines and adds no story;
the owner's review of `/design` after PR E is the place to decide whether to
add one.
