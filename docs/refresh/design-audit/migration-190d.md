# News, what's-new, SEO and best-* colour migration (#190 PR D)

Hard-coded colours on the news, what's-new, SEO and best-* pages, and in the
components only they use, move to `--ds-*` tokens. Nothing on the page
changes. The ratchet in `tests/unit/globals-consolidation-189.test.ts` drops
from 679 to 459: 220 uses in 18 files.

Each token holds the Tailwind palette colour the old class rendered, as HSL
precise to 1e-8 of a channel, like PR B ([migration-190b.md](migration-190b.md)).
A class with no `dark:` variant maps to a fixed token (one value in both
modes). A class pair such as `border-gray-200 dark:border-gray-700` maps to
one token with a light and a dark value.

## Files

| Group | Files | Uses |
|---|---|---|
| best-* | `app/[lang]/best-*/page.tsx` (9 pages) | 66 |
| What's new | `app/[lang]/whats-new/recent/page.tsx` (42), `components/whats-new/whats-new-navigation.tsx` (4) | 46 |
| News | `components/news/`: `news-card.tsx` (14), `news-content.tsx` (14), `article-scoring-impact.tsx` (14), `news-detail-content.tsx` (5), `metric-impact-display.tsx` (33) | 80 |
| SEO | `components/seo/quick-answer-box.tsx` (11), `tool-overview.tsx` (17) | 28 |

`news-card.tsx` renders on the tool page's news tab, not on a news route; it
is the news list's card and is migrated with it. `metric-impact-display.tsx`
and `tool-overview.tsx` are not rendered by any route today.

## Mapping

Resolved values are the rendered sRGB colour, light / dark. New tokens are
marked **new**.

| Old class | Token utility | Light | Dark | Uses |
|---|---|---|---|---|
| `text-white` | `text-ds-text-on-fill` | `#ffffff` | `#ffffff` | 18 |
| `text-yellow-500`, `bg-yellow-500` | `text-`/`bg-ds-accent-cat-yellow` **new** | `#eab308` | `#eab308` | 10 |
| `text-blue-500`, `bg-blue-500` | `text-`/`bg-ds-accent-cat-blue` | `#3b82f6` | `#3b82f6` | 15 |
| `text-green-500` (best-*), `bg-green-500` | `text-`/`bg-ds-accent-cat-green` | `#22c55e` | `#22c55e` | 16 |
| `bg-purple-500` | `bg-ds-accent-cat-purple` | `#a855f7` | `#a855f7` | 4 |
| `bg-orange-500` | `bg-ds-accent-cat-orange` **new** | `#f97316` | `#f97316` | 3 |
| `bg-blue-500/10 text-blue-500 border-blue-500/20` | `bg-ds-accent-cat-blue/10 text-ds-accent-cat-blue border-ds-accent-cat-blue/20` | `#3b82f6` at 10 / 100 / 20 % | same | 6 |
| `bg-orange-500/10 text-orange-500 border-orange-500/20` | `…-ds-accent-cat-orange…` with the same opacities | `#f97316` at 10 / 100 / 20 % | same | 6 |
| `text-green-500` (news gains) | `text-ds-success-solid` | `#22c55e` | `#22c55e` | 9 |
| `text-red-500` (news losses) | `text-ds-danger-solid` | `#ef4444` | `#ef4444` | 9 |
| `text-blue-600` | `text-ds-accent-fixed` | `#2563eb` | `#2563eb` | 6 |
| `text-purple-600` | `text-ds-accent-cat-purple-strong` **new** | `#9333ea` | `#9333ea` | 4 |
| `text-green-600` (category icons) | `text-ds-accent-cat-green-strong` **new** | `#16a34a` | `#16a34a` | 3 |
| `text-orange-600` | `text-ds-accent-cat-orange-strong` **new** | `#ea580c` | `#ea580c` | 3 |
| `text-yellow-600` | `text-ds-accent-cat-yellow-strong` **new** | `#ca8a04` | `#ca8a04` | 1 |
| `text-emerald-600` | `text-ds-accent-cat-emerald-strong` **new** | `#059669` | `#059669` | 1 |
| `text-indigo-600` | `text-ds-accent-cat-indigo-strong` **new** | `#4f46e5` | `#4f46e5` | 2 |
| `text-slate-600` | `text-ds-accent-cat-slate-strong` **new** | `#475569` | `#475569` | 1 |
| `text-green-600` (gains, SEO check icons) | `text-ds-success-fixed-mid` **new** | `#16a34a` | `#16a34a` | 6 |
| `text-green-400` | `text-ds-success-fixed-soft` **new** | `#4ade80` | `#4ade80` | 1 |
| `bg-green-50` | `bg-ds-success-fixed-subtle` **new** | `#f0fdf4` | `#f0fdf4` | 4 |
| `border-green-200` | `border-ds-success-fixed-border` **new** | `#bbf7d0` | `#bbf7d0` | 4 |
| `text-red-600` | `text-ds-danger-fixed` | `#dc2626` | `#dc2626` | 4 |
| `text-red-400` | `text-ds-danger-fixed-soft` | `#f87171` | `#f87171` | 1 |
| `bg-red-50` | `bg-ds-danger-fixed-subtle` **new** | `#fef2f2` | `#fef2f2` | 4 |
| `border-red-200` | `border-ds-danger-fixed-border` **new** | `#fecaca` | `#fecaca` | 4 |
| `text-gray-600` | `text-ds-text-paper-muted` | `#4b5563` | `#4b5563` | 3 |
| `text-gray-500` | `text-ds-text-paper-subtle` **new** | `#6b7280` | `#6b7280` | 1 |
| `text-gray-400` | `text-ds-text-paper-faint` **new** | `#9ca3af` | `#9ca3af` | 1 |
| `bg-gray-50` | `bg-ds-surface-paper-muted` | `#f9fafb` | `#f9fafb` | 3 |
| `border-gray-200` (impact panel) | `border-ds-border-paper` **new** | `#e5e7eb` | `#e5e7eb` | 3 |
| `bg-<hue>-100 dark:bg-<hue>-900/30` | `bg-ds-surface-tag-<hue>` **new** | 100 step, opaque | 900 step at 30 % | 12 |
| `text-<hue>-800 dark:text-<hue>-300` | `text-ds-text-tag-<hue>` **new** | 800 step | 300 step | 12 |
| `border-<hue>-200` (tags) | `border-ds-border-tag-<hue>` **new** | 200 step | 200 step | 6 |
| `border-gray-200 dark:border-gray-700` | `border-ds-border-neutral` **new** | `#e5e7eb` | `#374151` | 8 |
| `hover:border-gray-300 dark:hover:border-gray-600` | `hover:border-ds-border-neutral-hover` **new** | `#d1d5db` | `#4b5563` | 2 |
| `bg-green-50 dark:bg-green-950` | `bg-ds-surface-callout-success` **new** | `#f0fdf4` | `#052e16` | 4 |
| `border-green-200 dark:border-green-800` | `border-ds-border-callout-success` **new** | `#bbf7d0` | `#166534` | 4 |
| `text-green-600 dark:text-green-400` | `text-ds-text-callout-success` **new** | `#16a34a` | `#4ade80` | 2 |
| `text-green-700 dark:text-green-300` | `text-ds-text-callout-success-title` **new** | `#15803d` | `#86efac` | 2 |
| `bg-red-50 dark:bg-red-950` | `bg-ds-surface-callout-danger` **new** | `#fef2f2` | `#450a0a` | 2 |
| `border-red-200 dark:border-red-800` | `border-ds-border-callout-danger` **new** | `#fecaca` | `#991b1b` | 2 |
| `text-red-600 dark:text-red-400` | `text-ds-text-callout-danger` **new** | `#dc2626` | `#f87171` | 2 |
| `text-red-700 dark:text-red-300` | `text-ds-text-callout-danger-title` **new** | `#b91c1c` | `#fca5a5` | 2 |
| `bg-blue-50 dark:bg-blue-950` | `bg-ds-surface-callout-info` **new** | `#eff6ff` | `#172554` | 2 |
| `border-blue-200 dark:border-blue-800` | `border-ds-border-callout-info` **new** | `#bfdbfe` | `#1e40af` | 2 |

`<hue>` is purple, blue, green or orange (the what's-new kind badges). A
`dark:` variant counts as its own use, so each tag string is 5 uses.

## New tokens

42 colour tokens and one opacity token, listed in `app/globals.css` (the two
`#190 PR D` blocks) and mapped in `tailwind.config.js`.

- **No existing token held these colours.** The palette steps 600 of purple,
  orange, yellow, emerald, indigo and slate, the 50/200 tints, gray-400/500,
  and every light/dark pair above appear nowhere in the token layer.
- **Same value, different role.** `--ds-accent-cat-green-strong` and
  `--ds-success-fixed-mid` are both green-600: the first colours category
  icons (whats-new "feature", news "Adoption"), the second gains and checks.
  PR B set this precedent with `--ds-accent-cat-blue` and `--ds-info-solid`.
  Likewise `--ds-accent-cat-orange` and `--ds-accent-cat-yellow` share values
  with `--ds-warning-solid-strong` and `--ds-warning-solid`, which are status
  lamps.
- **`--ds-opacity-tag-surface`** is 1 in light and 0.3 in dark. The tag fill
  was `bg-<hue>-100` in light and `dark:bg-<hue>-900/30` in dark: the alpha
  changes with the mode, which an HSL colour token cannot carry. The tag
  surfaces' Tailwind mapping is `hsl(var(--ds-surface-tag-<hue>) /
  var(--ds-opacity-tag-surface))`. `tests/unit/design-tokens-188.test.ts`
  gains an `opacity` category for it.

The news labels keep their 10 % and 20 % opacity modifiers:
`bg-ds-accent-cat-blue/10` compiles to `hsl(var(--ds-accent-cat-blue) / 0.1)`,
as `bg-ds-accent-agent/10` does (#190 C2).

## Contrast below AA that this keeps

Parity keeps today's colours. These text pairs are below 4.5:1 and are not in
`AA_PAIRS`; raising them is a visible change for the owner.

| Pair | Ratio |
|---|---|
| `text-ds-success-fixed-mid` / `-solid` / `-soft` on `--ds-success-fixed-subtle` (impact high / medium / low) | 3.15 / 2.18 / 1.66 |
| `text-ds-danger-fixed` / `-solid` / `-fixed-soft` on `--ds-danger-fixed-subtle` | 4.41 / 3.44 / 2.53 |
| `text-ds-text-paper-faint` on `--ds-surface-paper-muted` (impact neutral low) | 2.43 |
| `text-ds-text-callout-success` on `--ds-surface-callout-success`, light | 3.15 |
| `text-ds-text-callout-danger` on `--ds-surface-callout-danger`, light | 4.41 |
| `text-ds-success-solid` / `text-ds-danger-solid` (news score and rank change) on white | 2.28 / 3.76 |
| `text-ds-accent-cat-blue` / `-orange` on its own 10 % fill over white (news labels) | 3.29 / 2.53 |

Added to `AA_PAIRS`: the four tag text/surface pairs (light 6.38 to 7.39;
dark checks the opaque 900 step, a lower bound for the 30 % fill on a dark
card), the two callout titles (4.79 / 10.62 success, 5.91 / 8.51 danger) and
`--ds-text-paper-subtle` on `--ds-surface-paper-muted` (4.63).

## Not migrated

| Uses | Where | Reason |
|---|---|---|
| 35 | `app/api/og/route.tsx`, `og/ranking`, `og/tool` | Open-graph images render through `@vercel/og`, which cannot read CSS variables. Already exempt from the ratchet (allowlist entry D2); unchanged. |
| 9 | `components/seo/seo-dashboard.tsx` | Rendered only by the authenticated dashboard (`app/[lang]/(authenticated)/dashboard/dashboard/page.tsx`): admin, PR E. |
| 30 | `components/ui/whats-new-modal.tsx` | Public modal: PR E. |

## How parity was checked

- `tests/unit/design-parity-190d.test.ts`: each token's light and dark value
  converts to the hex of the palette class it replaced, and the tag opacity
  is 1 / 0.3.
- Per mapping in Chromium: each old class string and its token string
  rendered in the same slot with the repo's `app/globals.css` and Tailwind
  config, light and `.dark`, compared pixel by pixel; a second render of the
  old string was the control. 46 mappings × 2 modes, 0 pixels different. A
  deliberate one-step change (green-600 to `--ds-success-fixed`) reported
  1,779 pixels.
- Page screenshots at 1280 and 375 px, light and dark, of the nine best-*
  pages, `/en/news`, a news article, `/en/whats-new`, `/en/whats-new/recent`
  and `/en/rankings` (QuickAnswerBox), before and after, with a second
  before run as the control.
- `/design` snapshots (`npm run test:visual`), zero tolerance, no baseline
  update.
