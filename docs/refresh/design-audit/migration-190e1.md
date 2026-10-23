# Public modals, contact form and error pages colour migration (#190 PR E1)

Hard-coded colours in the public modals, the contact form, the error and
not-found pages and three small components move to existing `--ds-*` tokens.
Nothing on the page changes. No token is added. The ratchet in
`tests/unit/globals-consolidation-189.test.ts` drops from 459 to 390: 69 of
the 128 uses in the 12 files below. The other 59 have no token with the
exact colour and stay (see "Not migrated").

Mappings reuse the tables in [migration-190b.md](migration-190b.md) and
[migration-190d.md](migration-190d.md). A class with no `dark:` variant maps
only to a fixed token (one value in both modes). The error and not-found
pages kept their colours in inline `style`; each colour moves to a class on
the same element, and the rest of the inline style stays.

## Files

| File | Uses | Migrated | Left |
|---|---|---|---|
| `components/ui/whats-new-modal.tsx` | 30 | 18 | 12 |
| `components/ui/changelog-modal.tsx` | 12 | 7 | 5 |
| `components/ui/signup-for-updates-modal.tsx` | 8 | 6 | 2 |
| `components/ui/tech-stack-modal.tsx` | 2 | 0 | 2 |
| `components/contact/contact-form.tsx` | 35 | 17 | 18 |
| `app/error.tsx` | 10 | 7 | 3 |
| `app/global-error.tsx` | 9 | 0 | 9 |
| `app/not-found.tsx` | 9 | 5 | 4 |
| `app/[lang]/not-found.tsx` | 9 | 5 | 4 |
| `components/dynamic-imports/DynamicCharts.tsx` | 2 | 2 | 0 |
| `components/ui/crown-icon.tsx` | 1 | 1 | 0 |
| `components/ui/optimized-image.tsx` | 1 | 1 | 0 |

`changelog-modal.tsx`, `tech-stack-modal.tsx`, `crown-icon.tsx` (the SVG
crown; pages use `crown-icon-server.tsx`) and `optimized-image.tsx` are not
imported by any route today. `DynamicCharts.tsx`'s `ChartSkeleton` is the
Suspense fallback of the `/trending` chart.

## Mapping

Resolved values are the rendered sRGB colour, light / dark.

| Old class or style | Token utility | Light | Dark | Uses |
|---|---|---|---|---|
| `text-purple-600` | `text-ds-accent-cat-purple-strong` | `#9333ea` | `#9333ea` | 2 |
| `text-blue-600` | `text-ds-accent-fixed` | `#2563eb` | `#2563eb` | 2 |
| `text-green-600` (what's-new feature icon) | `text-ds-accent-cat-green-strong` | `#16a34a` | `#16a34a` | 1 |
| `text-orange-600` | `text-ds-accent-cat-orange-strong` | `#ea580c` | `#ea580c` | 1 |
| `border-<hue>-200` (badges, no `dark:`) | `border-ds-border-tag-<hue>` | 200 step | 200 step | 7 |
| `bg-gray-200` | `bg-ds-surface-skeleton` | `#e5e7eb` | `#e5e7eb` | 7 |
| `bg-green-600` | `bg-ds-success-fixed-mid` | `#16a34a` | `#16a34a` | 1 |
| `hover:bg-green-700` | `hover:bg-ds-success-fixed` | `#15803d` | `#15803d` | 1 |
| `text-green-700` | `text-ds-success-fixed` | `#15803d` | `#15803d` | 4 |
| `bg-blue-100 dark:bg-blue-900/30` | `bg-ds-surface-tag-blue` | `#dbeafe` | `#1e3a8a` at 30 % | 4 |
| `bg-green-100 dark:bg-green-900/30` | `bg-ds-surface-tag-green` | `#dcfce7` | `#14532d` at 30 % | 2 |
| `text-green-600 dark:text-green-400` | `text-ds-text-callout-success` | `#16a34a` | `#4ade80` | 10 |
| `border-green-200` | `border-ds-success-fixed-border` | `#bbf7d0` | `#bbf7d0` | 1 |
| `border-red-200` | `border-ds-danger-fixed-border` | `#fecaca` | `#fecaca` | 1 |
| `text-red-600 dark:text-red-400` | `text-ds-text-callout-danger` | `#dc2626` | `#f87171` | 2 |
| `bg-green-500` | `bg-ds-success-solid` | `#22c55e` | `#22c55e` | 1 |
| `bg-blue-500` | `bg-ds-accent-cat-blue` | `#3b82f6` | `#3b82f6` | 1 |
| `bg-blue-600` | `bg-ds-accent-fixed` | `#2563eb` | `#2563eb` | 1 |
| `bg-gray-100` | `bg-ds-surface-paper-sunken` | `#f3f4f6` | `#f3f4f6` | 1 |
| `text-gray-500` | `text-ds-text-paper-subtle` | `#6b7280` | `#6b7280` | 1 |
| `text-yellow-500` | `text-ds-accent-cat-yellow` | `#eab308` | `#eab308` | 1 |
| `backgroundColor: "#f9fafb"` | `bg-ds-surface-paper-muted` | `#f9fafb` | `#f9fafb` | 3 |
| `color: "#6b7280"` | `text-ds-text-paper-subtle` | `#6b7280` | `#6b7280` | 4 |
| `backgroundColor: "#f3f4f6"` | `bg-ds-surface-paper-sunken` | `#f3f4f6` | `#f3f4f6` | 1 |
| `backgroundColor: "#3b82f6"` | `bg-ds-accent-cat-blue` | `#3b82f6` | `#3b82f6` | 3 |
| `color: "#3b82f6"` (links) | `text-ds-accent-cat-blue hover:text-ds-accent-cat-blue active:text-ds-accent-cat-blue` | `#3b82f6` | `#3b82f6` | 3 |
| `border: "1px solid #e5e7eb"` | `border-ds-border-paper`, inline `borderWidth: "1px"`, `borderStyle: "solid"` | `#e5e7eb` | `#e5e7eb` | 3 |
| `backgroundColor: "white"` | `bg-ds-surface-paper` | `#ffffff` | `#ffffff` | not counted |
| `color: "white"` (not-found links) | `text-ds-text-on-fill hover:text-ds-text-on-fill active:text-ds-text-on-fill` | `#ffffff` | `#ffffff` | not counted |
| `color: "white"` (error-page button) | `text-ds-text-on-fill` | `#ffffff` | `#ffffff` | not counted |

`<hue>` is purple, blue, green or orange. A `dark:` variant counts as its own
use. The ratchet does not count the `white` keyword in an inline style; it
moves with the other colours so each element takes its colours from one
place.

- **Links and buttons: state variants.** An inline colour on an element
  that a global element rule colours in another state is not converted to a
  plain token class. `app/globals.css` sets `a:hover` and `a:active` colours
  (specificity 0,1,1). An inline style beats them; a utility class (0,1,0)
  does not, because Tailwind 3.4 emits no cascade layers. The link would turn
  `--primary-hover` blue on hover. Such an element takes the token class and
  its `hover:` and `active:` variants (0,2,0), as the three error and
  not-found links do. Check `a`, `button` and form-control rules in
  `app/globals.css` before converting an inline colour, and give the parity
  script the element and states (`element`, `states`) so it renders them.
- **Border shorthand.** An inline `border: "1px solid"` sets `border-color`
  too, and an inline style beats a class. The width and style stay inline
  and the colour comes from the class.
- **Tag surfaces.** `bg-ds-surface-tag-*` compiles to
  `hsl(var(--ds-surface-tag-<hue>) / var(--ds-opacity-tag-surface))`, opaque
  in light and 30 % in dark, the same as `dark:bg-<hue>-900/30` (#190 PR D).
- **Same value, different role.** The changelog's version badge (green-600
  fill, green-700 hover) takes the success family, `--ds-success-fixed-mid`
  and `--ds-success-fixed`.

## Not migrated

No existing token holds these colours with the same light and dark values.
They stay as they are.

**Exempt under ruling Df8 (owner, 2026-10-23).** These 59 uses are exempt
from the colour ratchet. Each of the 9 files has its own entry in
`RATCHET_ALLOWLIST` (`tests/unit/globals-consolidation-189.test.ts`) with the
reason below and a `colourCap` at its current count, so adding a colour to
one of these files still fails the test. The baseline dropped from 264 to
205. No token was added.

| Uses | Where | Old | Value, light / dark | Nearest token and why it does not match |
|---|---|---|---|---|
| 16 | what's-new (12), changelog (2), tech-stack (2) badges | `bg-<hue>-100 text-<hue>-800`, no `dark:` | 100 / 800 step in both modes | `--ds-surface-tag-*` and `--ds-text-tag-*` switch to 900 at 30 % and 300 in dark |
| 1 | changelog "Changed" | `text-blue-700` | `#1d4ed8` both | `--ds-accent-hover`, `--ds-score-a`: light only |
| 2 | changelog "Fixed" | `text-red-700` | `#b91c1c` both | `--ds-danger`, `--ds-score-d`: light only |
| 2 | signup modal "Coming Soon" | `text-blue-800 dark:text-blue-400` | `#1e40af` / `#60a5fa` | `--ds-text-tag-blue` is `#1e40af` / `#93c5fd` |
| 4 | contact sign-up card | `from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20` | `#eff6ff`, `#eef2ff` / `#172554`, `#1e1b4b` at 20 % | none; gradient stops |
| 2 | contact sign-up card, mail icon | `text-blue-600 dark:text-blue-400` | `#2563eb` / `#60a5fa` | `--ds-accent` converts to the same hex, but its HSL (`221.2 83.2% 53.3%` / `213.1 93.9% 67.8%`) is not exact; full Chrome for Testing 1223, 1234 and 1243 antialias the icon differently, 40 px light and 56 px dark |
| 2 | contact sign-up card | `border-blue-200 dark:border-blue-900` | `#bfdbfe` / `#1e3a8a` | `--ds-border-callout-info` is `#bfdbfe` / `#1e40af` |
| 2 | contact success alert | `bg-green-50 dark:bg-green-950/20` | `#f0fdf4` / `#052e16` at 20 % | `--ds-surface-callout-success` is opaque in dark |
| 2 | contact success alert | `text-green-800 dark:text-green-200` | `#166534` / `#bbf7d0` | `--ds-text-tag-green` is `#166534` / `#86efac` |
| 2 | contact error alert | `bg-red-50 dark:bg-red-950/20` | `#fef2f2` / `#450a0a` at 20 % | `--ds-surface-callout-danger` is opaque in dark |
| 2 | contact error alert | `text-red-800 dark:text-red-200` | `#991b1b` / `#fecaca` | none |
| 1 | contact status dot, unsubscribed | `bg-gray-400` | `#9ca3af` both | `--ds-text-paper-faint`: a text token |
| 1 | contact GitHub dot | `bg-gray-800` | `#1f2937` both | `--ds-surface-signal`: dark only |
| 6 | error, not-found (×2) card | `boxShadow` with `rgba(0, 0, 0, 0.1)` and `rgba(0, 0, 0, 0.06)` | `0 1px 3px 0 / 0 1px 2px 0` | `--shadow-sm` uses `-1px` spread and 0.1 alpha |
| 3 | error, not-found (×2) heading | `color: "#111827"` | gray-900 both | `--ds-surface-footer`: a surface token |
| 2 | not-found (×2) subheading | `color: "#374151"` | gray-700 both | `--ds-border-footer`: a border token |
| 9 | `app/global-error.tsx` | all its inline colours | | tokens do not reliably resolve there; see below |

**`app/global-error.tsx` is unchanged.** It replaces the root layout when
`app/layout.tsx` itself fails, and renders its own `<html>` and `<body>`.
`app/layout.tsx` is the only file that loads `app/globals.css`, which
`tests/unit/globals-consolidation-189.test.ts` enforces, and
`global-error.tsx` imports no stylesheet. With the root layout replaced or
failed, neither the `--ds-*` variables nor the `ds-` utility classes are
guaranteed on the page, so its literal colours are the safe form. Next.js
renders this file only in production builds, so this was checked by reading
the code, not by a render.

## How parity was checked

- `tests/unit/design-parity-190e1.test.ts`: each token's light and dark value
  converts to the hex of the palette class or inline colour it replaced; each
  inline hex equals the palette step named for it; the tag opacity is 1 / 0.3.
- `scripts/design-parity-pixels.ts --set 190e1`: each old class or inline
  style and its token form rendered in the same element in Chromium with the
  repo's `app/globals.css` and Tailwind config, light and `.dark`, then the
  old form again as the control. Each mapping renders in the element the page
  uses (`div`, `a` or `button`); the link and button mappings are shot at
  rest, with the pointer over them, and with the mouse button held down.
  31 mappings, 78 mode/state rows, 0 pixels different, in Chrome for Testing
  1223, 1234 and 1243 and chrome-headless-shell 1223, 1234 and 1243. A
  deliberate one-step change (`text-green-600` to `text-ds-success-fixed`,
  green-700) reported 935 pixels in each mode. Without the `hover:` and
  `active:` variants, the links differ by 932 to 951 pixels on hover and
  active.
- `scripts/design-audit-shots.ts --set states`: the what's-new modal (loading,
  the recent tab with a fixture feed that shows every icon and badge colour,
  and the summary tab loading), the contact page, the sign-up modal, and the
  root and localized not-found pages, at 375, 768 and 1280 px, light and
  dark: `before` at the base commit, `after` and `after2` with this change.
  The error boundary has no route that reaches it in development, and the
  contact form has no input or validation message; the parity script covers
  their colours.
- `/design` snapshots (`npm run test:visual`), zero tolerance, no baseline
  update.
