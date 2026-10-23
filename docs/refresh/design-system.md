# Design system: contributor guide (#190)

How to build and change UI on the `--ds-*` tokens. Token values and roles:
[design-tokens.md](design-tokens.md). Current-UI audit:
[design-audit/README.md](design-audit/README.md).

## Rules

1. **Colour comes from tokens.** Use the `ds` Tailwind utilities
   (`bg-ds-surface`, `text-ds-text-muted`, `border-ds-border`) or
   `hsl(var(--ds-*))` in CSS. No palette classes (`text-gray-600`), no hex,
   no `rgb(`.
2. **No `dark:` variants.** Tokens switch with the `.dark` class on an
   ancestor.
3. **Semantic props, not colour names.** `tone="danger"`, never
   `color="red"`.
4. **Focus is visible.** Interactive components show `--ds-focus-ring` on
   `:focus-visible`.
5. **Motion uses `--ds-duration-*` and `--ds-ease-*`**, so reduced motion
   applies.
6. **A new token** gets a light and a dark value, a Tailwind mapping, and a
   contrast pair in `scripts/design-tokens.ts` (`AA_PAIRS` for text,
   `NON_TEXT_PAIRS` for rings and borders).

## The `/design` page

`/design` (`app/design/`) shows each core component in each state, once in a
light panel and once in a `.dark` panel: card, table, badge, nav, footer,
score pill, rank change, alert, form controls and modifier text. It is
`noindex`, linked from nowhere and not in the sitemap. In production it
answers 404 unless `DESIGN_PREVIEW` is set before the build
(`app/design/preview-gate.ts`); dev servers and `npm run test:visual` render it.

- **Hover and focus samples are forced.** A sample marked
  `data-force-state="hover"` or `"focus"` gets the component's own hover or
  focus CSS, copied by `app/design/force-states.tsx`. Nothing is restyled by
  hand.
- **Add a component:** add a `Sample` per state in
  `app/design/design-preview.tsx`, and add the component and its states to
  `REQUIRED` in `tests/unit/design-page-190.test.tsx`.
- **Keep the shared stylesheet unchanged.** Tailwind compiles every class
  name it finds in `app/`, so a class used only on `/design` adds CSS to
  every page. Use classes the site already uses, and compare
  `.next/static/css/*.css` before and after `next build`.

## Checks

| Command | Checks | In `npm run gate:local` |
|---|---|---|
| `npx vitest run tests/unit/design-tokens-188.test.ts` | Token categories, Tailwind mapping, text contrast 4.5:1 | Yes |
| `npx vitest run tests/unit/design-contrast-190.test.ts` | Focus ring and borders 3:1 on each surface; named exceptions | Yes |
| `npx vitest run tests/unit/globals-consolidation-189.test.ts` | One stylesheet; hard-coded colour ratchet | Yes |
| `npx vitest run tests/unit/tailwind-colour-classes-190.test.ts` | Every `text-`, `bg-` and `border-` class in source compiles to a utility | Yes |
| `npx vitest run tests/unit/design-page-190.test.tsx` | Every component and state on `/design`; noindex, unlinked, not in the sitemap, production 404 gate | Yes |
| `npm run test:visual` | `/design` snapshots at 375, 768 and 1280 px, light and dark | No (needs a browser) |

**Ratchet.** `HARDCODED_COLOUR_BASELINE` in the ratchet test is the measured
count of hard-coded colours in `components/` and `app/`. When you migrate
colours to tokens, lower it to the new count; never raise it. The one
allowlist in that test exempts the open-graph image routes, the contact email
HTML and the `--shadow*` declarations in `app/globals.css`, each with its
reason. Any other literal colour in `app/globals.css` counts.

**Contrast exceptions.** `--ds-border` and `--ds-border-strong` are below 3:1
on every surface in both modes. They are listed by name in
`KNOWN_EXCEPTIONS`; raising them is a visible change for the owner to approve.
The test fails if an exception starts to pass, so the list stays current.

**Visual tests.** `npm run test:visual` starts `next dev` on port 3017 with
`NEXT_PUBLIC_DISABLE_AUTH=true` (or uses `DESIGN_BASE_URL`), and compares each
panel with `tests/visual/__snapshots__/design-<mode>-<width>-<platform>.png`
at zero tolerance. If Playwright's bundled Chromium is not installed, set
`PLAYWRIGHT_CHROMIUM_PATH` to a Chromium or headless-shell binary. After an
intended visual change, run `npm run test:visual -- --update-snapshots` and
commit the new images with the change. Baselines are per platform; the first
run on a new platform writes its own.

## Proving a change is invisible

For a change meant to look the same, compare existing pages with
`scripts/design-audit-shots.ts` (`before`, `after`, and an `after2` control
for run-to-run noise), as described in
[design-audit/README.md](design-audit/README.md). A change that leaves the
compiled stylesheet byte-identical needs no screenshots.
