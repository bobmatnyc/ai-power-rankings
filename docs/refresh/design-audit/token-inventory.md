# Current-UI token inventory (#188)

Input to the design-system token layer (`docs/refresh/design-tokens.md`).
Taken from `app/globals.css`, `tailwind.config.js` and a scan of the 271
`.ts`, `.tsx` and `.css` files under `components/` and `app/` (test files
excluded) at `f9db0a0f`. Counts are class occurrences, variant prefixes
(`dark:`, `hover:`, `md:`) stripped.

## Colour

The palette is the shadcn/ui variable set, as HSL components in
`app/globals.css`, mapped to Tailwind colours in `tailwind.config.js`.

| Variable | Light | Dark | Notes |
|---|---|---|---|
| `--background` | `0 0% 100%` | `222.2 84% 4.9%` | |
| `--foreground` | `222.2 84% 4.9%` | `210 40% 98%` | |
| `--card`, `--popover` | `0 0% 100%` | `222.2 84% 4.9%` | Same as background in both modes |
| `--primary` | `217 91% 59%` | `217 91% 59%` | White on primary is 3.76:1, below AA for normal text |
| `--secondary` | `142 71% 45%` (green) | `217.2 32.6% 17.5%` (slate) | Changes hue between modes |
| `--accent` | `199 89% 48%` (sky) | `217.2 32.6% 17.5%` (slate) | Changes hue between modes |
| `--muted` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | |
| `--muted-foreground` | `215.4 16.3% 46.9%` | `215 20.2% 65.1%` | Light: 4.34:1 on `--muted`, below AA |
| `--border`, `--input` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | |
| `--ring` | `217 91% 59%` | `217 91% 59%` | |
| `--success`, `--warning`, `--error`, `--info` | green, amber, red, sky | same | No dark values for the `-foreground` pairs |
| `--ds-rank-up/down/steady` (#178) | green-600, red-600, gray-500 | green-400, red-400, gray-400 | Used by `RankingChange` |

`destructive` is used 14 times (`bg-destructive`, `text-destructive`,
`border-destructive/50`, …) but neither `app/globals.css` nor
`tailwind.config.js` defines it, so those classes emit no CSS. `--ds-danger`
is the replacement when #189 migrates them.

There is no theme toggle: nothing in `app/`, `components/` or `contexts/`
adds the `dark` class to `<html>`. The `.dark` values and the 84 `dark:`
variants across 23 files are never applied on the live site today. The audit
screenshots force the class to show what dark mode would look like.

Most-used semantic colour classes: `text-muted-foreground` 622,
`text-primary` 138, `bg-muted` 71, `bg-primary` 56, `text-foreground` 46,
`bg-muted/50` 41, `bg-secondary` 33, `bg-background` 21. The hard-coded palette
classes are listed in [one-off-styles.md](one-off-styles.md).

## Type scale

Fluid `clamp()` sizes, `--font-size-xs` to `--font-size-5xl`, mapped over
Tailwind's `text-xs` … `text-5xl`. Line heights `--line-height-tight` (1.1)
to `--line-height-loose` (1.75), plus `--line-height-body` (1.65). Weights 400,
500, 600, 700, 900. Font stack: system UI (`html`), with `--font-geist-sans`
first in Tailwind's `font-sans`; nothing defines `--font-geist-sans`, so the
system stack renders.

| Class | Uses | | Class | Uses |
|---|---|---|---|---|
| `text-sm` | 558 | | `text-3xl` | 79 |
| `text-xs` | 204 | | `text-base` | 20 |
| `text-2xl` | 105 | | `text-4xl` | 18 |
| `text-lg` | 100 | | `text-5xl` | 9 |
| `text-xl` | 85 | | `text-6xl`, `text-[10px]` | 1 each |

Weights: `font-medium` 229, `font-bold` 203, `font-semibold` 187,
`font-normal` 4. `text-6xl` has no `--font-size-6xl`, so it falls back to
Tailwind's default `3.75rem`.

## Spacing

`--space-1` (0.25rem) to `--space-24` (6rem), mapped over Tailwind's numeric
spacing keys. Half steps (`gap-1.5`, `py-0.5`) and keys with no variable fall
back to Tailwind defaults. Most used: `gap-2` 289, `mb-4` 154, `gap-3` 152,
`mt-2` 122, `gap-4` 115, `p-6` 102, `mb-2` 100, `p-4` 97, `space-y-2` 96,
`mr-2` 89, `mb-8` 87, `space-y-4` 86. `p-6` and `p-4` are the card paddings;
`gap-2` and `gap-3` the inline gaps.

## Radius

`--radius` 0.5rem; `--radius-sm` 0.25rem, `-md` 0.375rem, `-lg` 0.5rem,
`-xl` 0.75rem, `-2xl` 1rem, `-full` 9999px.

| Class | Uses | Typical element |
|---|---|---|
| `rounded-full` | 153 | Avatars, badges, dots |
| `rounded-lg` | 124 | Cards, panels |
| `rounded` | 85 | Small chips, inputs (Tailwind default 0.25rem) |
| `rounded-md` | 47 | Buttons, inputs (`components/ui/button.tsx`) |
| `rounded-sm` | 4 | |

## Shadows

`--shadow-xs` to `--shadow-2xl` plus `--shadow-inner`, black at 5–25 % opacity
written as `rgb(0 0 0 / …)`, with no dark-mode values. Uses: `shadow-lg` 69,
`shadow-sm` 16, `shadow-md` 8, `shadow` 6, `shadow-xl` 1.

## Motion

Durations `--duration-instant` 50ms to `--duration-slower` 500ms; easings
`--ease-linear`, `-in`, `-out`, `-in-out`, `-spring`. Keyframe utilities
`animate-fade-in`, `-fade-in-up`, `-fade-in-down`, `-scale-in`,
`-slide-in-right`, `-pulse`. A `prefers-reduced-motion` block in
`app/globals.css` already shortens animations site-wide.

## Component classes in globals.css

`.btn-primary`, `.btn-secondary`, `.card`, `.badge`, `.hero-title`,
`.hero-subtitle`, `.section-title`, `.section-subtitle`, `.text-gradient`,
`.prose` overrides, `.lead`, `.hover-lift`, `.hover-scale`. They read the
shadcn variables. #190 replaces them with components on the `--ds-*` layer.
