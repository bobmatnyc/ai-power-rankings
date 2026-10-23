# Auth components and authenticated pages colour migration (#190 PR E2b)

E2b moves hard-coded colours in the auth components and the authenticated
pages to existing `--ds-*` tokens. Nothing on the page changes. No token is
added. E2b-1 covers `components/auth/**` and
`app/[lang]/(authenticated)/layout.tsx`; E2b-2 covers the rest of
`app/[lang]/(authenticated)/**` and extends the same table.

The mapping lives in `scripts/design-class-maps.ts` (set `190e2b`), which the
class-diff check, the pixel check and the unit test all read, as in E2a
(`migration-190e2a.md`).

## E2b-1: auth components

31 counted uses in 9 files: 15 move to tokens, 14 stay under ruling Df8 with a
per-file cap, and 2 are Clerk's `colorPrimary`, exempt permanently. The
ratchet in `tests/unit/globals-consolidation-189.test.ts` drops from 150 to
119.

### Files

| File | Uses | Migrated | Df8 cap | Permanent |
|---|---|---|---|---|
| `components/auth/no-auth-provider.tsx` | 11 | 6 | 5 | 0 |
| `components/auth/clerk-header.tsx` | 7 | 4 | 3 | 0 |
| `components/auth/auth-components-simple.tsx` | 3 | 0 | 3 | 0 |
| `components/auth/clerk-debug.tsx` | 2 | 2 | 0 | 0 |
| `components/auth/clerk-direct-components.tsx` | 2 | 0 | 2 | 0 |
| `components/auth/no-auth-header.tsx` | 2 | 2 | 0 | 0 |
| `components/auth/user-button-with-admin.tsx` | 2 | 1 | 1 | 0 |
| `components/auth/clerk-provider-client.tsx` | 1 | 0 | 0 | 1 |
| `app/[lang]/(authenticated)/layout.tsx` | 1 | 0 | 0 | 1 |
| **Total** | **31** | **15** | **14** | **2** |

`clerk-provider-client.tsx` and `clerk-debug.tsx` have no importers. Per the
architect ruling (2026-10-23) they stay; what maps is migrated and the rest is
capped.

### Mapping

Resolved values are the rendered sRGB colour, light / dark. A variant prefix
(`hover:`) and an opacity modifier (`/80`) carry over.

| Old class | Token | Light | Dark | Uses | Where |
|---|---|---|---|---|---|
| `bg-white` | `bg-ds-surface-paper` | `#ffffff` | `#ffffff` | 2 | Sign In button, dev user menu |
| `hover:bg-gray-50` | `hover:bg-ds-surface-paper-muted` | `#f9fafb` | `#f9fafb` | 1 | Sign In button |
| `bg-gray-100`, `hover:bg-gray-100` | `bg-ds-surface-paper-sunken` | `#f3f4f6` | `#f3f4f6` | 3 | dev email chip, dev menu link and button |
| `bg-gray-200` | `bg-ds-surface-skeleton` | `#e5e7eb` | `#e5e7eb` | 1 | fallback avatar skeleton |
| `bg-gray-900` | `bg-ds-surface-footer` | `#111827` | `#111827` | 1 | staging tooltip |
| `bg-black/80` | `bg-ds-surface-overlay/80` | `#000000` at 80 % | same | 1 | debug panel |
| `border-gray-200` | `border-ds-border-paper` | `#e5e7eb` | `#e5e7eb` | 1 | dev user menu |
| `text-gray-600` | `text-ds-text-paper-muted` | `#4b5563` | `#4b5563` | 1 | dev-mode label |
| `text-white` | `text-ds-text-on-fill` | `#ffffff` | `#ffffff` | 3 | Sign Up button, debug panel, tooltip |
| `bg-blue-600` | `bg-ds-accent-fixed` | `#2563eb` | `#2563eb` | 1 | Sign Up button |

- **Links.** The only converted class on an `a` is the dev menu link's
  `hover:bg-gray-100`. The global `a`, `a:hover` and `a:active` rules set
  `color` and a `background-image` underline, not `background-color`, so the
  token needs no extra `hover:` or `active:` text variant. The link keeps its
  `text-gray-700`, which has no token.
- **Tooltip.** `--ds-surface-footer` is the one surface token that is gray-900
  in both modes. `--ds-surface-signal` is gray-900 in light only, and the unit
  test and the pixel control both show it fail in dark. The tooltip arrow's
  `border-t-gray-900` is outside the ratchet's patterns and stays.
- **Inline JS colours.** The subscription item's `onMouseEnter`
  `rgba(0, 0, 0, 0.03)` stays: no token holds that value.

### Permanent exemption

Architect ruling, 2026-10-23: the same class as the D2 open-graph exemption.
One `RATCHET_ALLOWLIST` entry covers both files, with `literalCap: 2` and
`colourCap: 2` so nothing else can be added to them unseen.

| File | Value | Reason |
|---|---|---|
| `app/[lang]/(authenticated)/layout.tsx` | `colorPrimary: '#000000'` | Clerk reads `appearance.variables` in JavaScript to build its own palette, so it cannot read a `--ds-*` token. |
| `components/auth/clerk-provider-client.tsx` | `colorPrimary: "#000000"` | Same. |

### Not migrated (Df8)

No existing token holds these colours with the same value in light and dark
in the same role. Each file has its own `RATCHET_ALLOWLIST` entry with the
reason below and a `colourCap` at its measured count.

| File | `colourCap` | Old | Value, light / dark | Nearest token and why it does not match |
|---|---|---|---|---|
| `no-auth-provider.tsx` | 5 | `text-gray-700` (3) | `#374151` both | `--ds-border-footer`: a border token |
| | | `bg-gray-300` | `#d1d5db` both | `--ds-text-footer`: a text token; `--ds-border-neutral-hover` is gray-300 in light only |
| | | `hover:bg-gray-400` | `#9ca3af` both | `--ds-text-paper-faint`: a text token |
| `clerk-header.tsx` | 3 | `text-gray-700` | `#374151` both | `--ds-border-footer`: a border token |
| | | `border-gray-300` | `#d1d5db` both | `--ds-text-footer`: a text token; `--ds-border-neutral-hover` is light only |
| | | `hover:bg-blue-700` | `#1d4ed8` both | `--ds-accent-hover` is blue-700 in light only |
| `auth-components-simple.tsx` | 3 | `bg-yellow-100`, `border-yellow-300`, `text-yellow-800` | 100 / 300 / 800 step both | none |
| `clerk-direct-components.tsx` | 2 | `hover:bg-gray-100 dark:hover:bg-gray-800` | `#f3f4f6` / `#1f2937` | none holds the pair; mapping only the light class would half-migrate it |
| `user-button-with-admin.tsx` | 1 | inline `rgba(0, 0, 0, 0.03)` | same both | none |

### Ratchet

| | Before | After |
|---|---|---|
| `HARDCODED_COLOUR_BASELINE` | 150 | 119 |
| Counted uses in the 9 files | 31 | 0 |

Two negative runs showed the gate still bites: an extra `active:bg-blue-800`
in `clerk-header.tsx` failed its cap (4 > 3), and a baseline of 118 failed the
global test (119 > 118). Both were reverted.

### How parity was checked

- **Class diff.** `npx tsx scripts/design-class-diff.ts --set 190e2b`: 9 files
  against `origin/main`, 0 unexplained changes, 15 substitutions. E2b-1 also
  closes a gap in the check: a light class with a variant prefix
  (`hover:bg-gray-100`) next to its `dark:hover:` partner used to map alone.
  It now maps only as a pair. The E2a set still passes against its own base.
- **Unit test.** `tests/unit/design-parity-190e2b.test.ts` runs the shared
  suite in `tests/unit/design-parity-suite.ts` (also used by the E2a test):
  each token's light and dark HSL equals the `tailwindcss/colors` value to
  0.05 of a channel step, each token has the old class's role, and
  `tailwind-merge` treats both classes the same. It adds a light-only control
  and class-diff cases for a wrong token, a dropped `hover:` and a half-mapped
  `hover:`/`dark:hover:` pair. Mapping `bg-gray-900` to `--ds-surface-signal`
  failed it, and so did the old partner check on the half-mapped pair.
- **Pixels.** `scripts/design-parity-pixels.ts --set 190e2b` renders each
  auth class string as the component writes it, in its element (`div`,
  `button` or `a`), light and `.dark`, at rest, hover and active, on full
  Chrome for Testing 153.0.8010.12 (Playwright build 1243, not the headless
  shell): 10 mappings, 63 mode/state rows, 0 pixels different. The controls
  differed: `--ds-surface-signal` for `bg-gray-900` in dark by 14,344 pixels,
  and the dev menu link without its hover background by 4,991 / 4,994.
- **`/design` snapshots.** `npm run test:visual` on headless shell 1243, zero
  tolerance, no baseline update: 6 of 6 pass. `/design` sits outside the
  `[lang]` layout, so it does not render the auth header; the pixel check
  above is the evidence for these components.

## E2b-2: authenticated pages

119 counted uses in the 12 remaining files under `app/[lang]/(authenticated)/`:
46 move to tokens, 42 stay under ruling Df8 with a per-file cap, and
`clerk-debug/page.tsx`'s 31 stay unchanged under a cap by architect ruling.
The ratchet drops from 119 to 0.

### Files

| File (under `app/[lang]/(authenticated)/`) | Uses | Migrated | Capped |
|---|---|---|---|
| `clerk-debug/page.tsx` | 31 | 0 | 31 (ruling) |
| `unauthorized/page.tsx` | 23 | 4 | 19 |
| `dashboard/rankings/[period]/changes/ranking-changes-summary.tsx` | 13 | 7 | 6 |
| `dashboard/auth/error/page.tsx` | 12 | 7 | 5 |
| `admin/automated-ingestion/automated-ingestion-client.tsx` | 11 | 9 | 2 |
| `admin/whats-new-summary/whats-new-summary-client.tsx` | 9 | 5 | 4 |
| `admin/state-of-ai/state-of-ai-client.tsx` | 8 | 6 | 2 |
| `dashboard/tools/[slug]/dashboard-tool-detail.tsx` | 4 | 0 | 4 |
| `admin/news/edit/[id]/page.tsx` | 3 | 3 | 0 |
| `admin/news/new/page.tsx` | 2 | 2 | 0 |
| `dashboard/cache/cache-client.tsx` | 2 | 2 | 0 |
| `dashboard/rankings/page.tsx` | 1 | 1 | 0 |
| **Total** | **119** | **46** | **73** |

### Mapping

Entries added to set `190e2b`; E2b-1's entries are reused unchanged
(`bg-white`, `bg-gray-50`, `bg-gray-200`, `bg-black`, `text-gray-600`,
`text-white`, `bg-blue-600`).

| Old class | Token | Light | Dark | Uses | Where |
|---|---|---|---|---|---|
| `text-gray-500` | `text-ds-text-paper-subtle` | `#6b7280` | `#6b7280` | 1 | rankings loader |
| `text-blue-600` | `text-ds-accent-fixed` | `#2563eb` | `#2563eb` | 2 | "new" count and icon |
| `text-blue-500` | `text-ds-accent-cat-blue` | `#3b82f6` | `#3b82f6` | 2 | daily-news icon, analysis link |
| `text-purple-500` | `text-ds-accent-cat-purple` | `#a855f7` | `#a855f7` | 1 | monthly icon |
| `text-orange-500` | `text-ds-accent-cat-orange` | `#f97316` | `#f97316` | 1 | manual icon |
| `border-blue-200` | `border-ds-border-tag-blue` | `#bfdbfe` | `#bfdbfe` | 2 | what's-new note box, help card |
| `text-green-500`, `bg-green-500` | `…-ds-success-solid` | `#22c55e` | `#22c55e` | 2 | cache icon, sentiment bar |
| `text-green-600` | `text-ds-success-fixed-mid` | `#16a34a` | `#16a34a` | 4 | counts and icons |
| `bg-green-50` | `bg-ds-success-fixed-subtle` | `#f0fdf4` | `#f0fdf4` | 1 | what's-new alert |
| `border-green-200` | `border-ds-success-fixed-border` | `#bbf7d0` | `#bbf7d0` | 1 | what's-new alert |
| `text-red-500` | `text-ds-danger-solid` | `#ef4444` | `#ef4444` | 1 | cache icon |
| `text-red-600` | `text-ds-danger-fixed` | `#dc2626` | `#dc2626` | 4 | auto-save error, counts and icons |
| `bg-green-50 dark:bg-green-950` | `bg-ds-surface-callout-success` | `#f0fdf4` | `#052e16` | 4 (2 pairs) | ingestion and State of AI alerts |
| `border-green-200 dark:border-green-800` | `border-ds-border-callout-success` | `#bbf7d0` | `#166534` | 4 (2 pairs) | same |
| `text-green-600 dark:text-green-400` | `text-ds-text-callout-success` | `#16a34a` | `#4ade80` | 4 (2 pairs) | same alerts' icons |
| `text-red-600 dark:text-red-400` | `text-ds-text-callout-danger` | `#dc2626` | `#f87171` | 2 (1 pair) | access-denied icon |

Plus the reused entries: `bg-gray-50` (2), `bg-white`, `bg-gray-200`,
`text-gray-600`, `bg-black/50`, `bg-blue-600` (2) and `text-white` (2).

- **Interleaved pairs.** The two success alerts write
  `bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800`.
  `design-class-diff.ts` now moves a pair's `dark:` class next to its light
  class inside one class string before it aligns, so each pair maps to its
  one token; a light class mapped alone, or a dropped `dark:` class, still
  fails. Class order inside a string does not change the CSS. The pixel
  script's table builder handles the same shape.
- **Links.** Every converted link colour here is a class replaced by a class
  (`text-blue-500`, `text-white`, `hover:bg-gray-50`), so the global
  `a:hover` and `a:active` rules beat old and new alike and no `hover:` or
  `active:` variant is added. A pixel control shows that adding them would
  change the hover and active colour.
- **`bg-gray-200` on the auth-error "Back to Home" link** takes
  `--ds-surface-skeleton`, the only surface token that is gray-200 in both
  modes, as in E1 and E2a.
- `unauthorized/page.tsx:33`'s `text-gray-500 dark:text-gray-500` stays as is.

### Not migrated

`clerk-debug/page.tsx` is left byte-for-byte unchanged with one
`RATCHET_ALLOWLIST` entry, `colourCap: 31`, reason "developer page; capped by
Architect ruling 2026-10-23, parity only". It is not in the set's file list.

The rest have no token with the same value in light and dark in the same
role. Each file has its own entry with the reason below and a `colourCap` at
its measured count.

| File | `colourCap` | Old | Value, light / dark | Nearest token and why it does not match |
|---|---|---|---|---|
| `unauthorized/page.tsx` | 19 | `bg-red-100 dark:bg-red-900/20` | red-100 / red-900 at 20 % | none |
| | | `text-gray-900 dark:text-white` | gray-900 / white | `--ds-text` is `#020817` / slate-50 |
| | | `text-gray-600 dark:text-gray-400` (2 places) | gray-600 / gray-400 | `--ds-text-muted` is slate |
| | | `text-gray-500 dark:text-gray-500` | gray-500 both | left as is (a `dark:` no-op) |
| | | `hover:bg-blue-700` | blue-700 both | `--ds-accent-hover` is blue-700 in light only |
| | | `bg-gray-200 dark:bg-gray-700`, `hover:bg-gray-300 dark:hover:bg-gray-600` | gray-200 / 700, gray-300 / 600 | `--ds-border-neutral(-hover)`: border tokens |
| | | `text-gray-900 dark:text-white` (button) | gray-900 / white | as above |
| | | `bg-gray-50 dark:bg-gray-800` | gray-50 / gray-800 | none |
| `ranking-changes-summary.tsx` | 6 | `bg-<hue>-100 text-<hue>-800` (green, red, blue) | 100 / 800 both | the tag tokens switch to 900 and 300 in dark |
| `dashboard/auth/error/page.tsx` | 5 | `bg-red-100` | red-100 both | none |
| | | `text-gray-900`, `text-gray-800` | 900 / 800 step both | only surface or gradient tokens |
| | | `hover:bg-blue-700` | blue-700 both | `--ds-accent-hover` is light only |
| | | `hover:bg-gray-300` | gray-300 both | `--ds-text-footer`: a text token |
| `dashboard-tool-detail.tsx` | 4 | `bg-<hue>-100 text-<hue>-800` (green, red) | 100 / 800 both | the tag tokens switch in dark |
| `whats-new-summary-client.tsx` | 4 | `text-green-800` | green-800 both | `--ds-grad-green-800`: a gradient token |
| | | `bg-blue-50`, `bg-blue-50/50` | blue-50 both | `--ds-accent-subtle` is blue-900 in dark |
| | | `text-blue-800` | blue-800 both | `--ds-text-tag-blue` is blue-300 in dark |
| `automated-ingestion-client.tsx` | 2 | `text-green-800 dark:text-green-200` | green-800 / green-200 | `--ds-text-callout-success-title` is green-700 / green-300 |
| `state-of-ai-client.tsx` | 2 | same | same | same |

### Ratchet

| | Before | After |
|---|---|---|
| `HARDCODED_COLOUR_BASELINE` | 119 | 0 |
| Counted uses in the 12 files | 119 | 0 |

Two negative runs showed the gate still bites: an extra `active:bg-blue-800`
in `dashboard/auth/error/page.tsx` failed its cap (6 > 5), and a baseline of
-1 failed the global test (0 > -1). Both were reverted.

### How parity was checked

- **Class diff.** `npx tsx scripts/design-class-diff.ts --set 190e2b`: 20
  files against `origin/main`, 0 unexplained changes, 46 substitutions in the
  E2b-2 files. Before the pair grouping the two alert blocks failed. The E2a
  set still passes against its own base.
- **Unit test.** `tests/unit/design-parity-190e2b.test.ts` checks every new
  entry's light and dark value and role through the shared suite, which now
  also runs the merge-group check on each pair's light class. It adds
  class-diff cases for interleaved pairs: both mapped passes, one pair mapped
  and the other left whole passes, a light class mapped alone and a dropped
  `dark:` class fail.
- **Pixels.** `scripts/design-parity-pixels.ts --set 190e2b` on full Chrome for
  Testing 153.0.8010.12 (Playwright build 1243): 41 parity mappings, 254
  mode/state rows, 0 pixels different. Each page class string renders as the
  page writes it (Alert boxes as `cn()` leaves them), in its element, light
  and dark, at rest, hover and active. The new controls differed: the alert
  pairs mapped by their light classes only, in dark, by 16,783 pixels, and a
  `text-blue-500` link given `hover:`/`active:` token variants by 946 to 951.
  This per-mapping run is E2b-2's pixel evidence (architect ruling); the
  authenticated pages cannot be screenshotted (ruling D1).
