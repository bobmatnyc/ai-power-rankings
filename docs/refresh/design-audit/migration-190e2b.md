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
