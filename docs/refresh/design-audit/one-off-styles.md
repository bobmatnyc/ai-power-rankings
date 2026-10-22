# One-off styles: hard-coded colours (#188)

Every colour in `components/` and `app/` that bypasses the token variables,
counted per file at `f9db0a0f`. These are the migration list for #189; the
`--ds-*` layer (`docs/refresh/design-tokens.md`) has a semantic token for each
use. Nothing here changes in #188.

## Method

271 `.ts`, `.tsx` and `.css` files scanned, test files excluded. Comment text
is stripped first, so issue references such as `#156` are not counted as hex.
Variant prefixes (`dark:`, `hover:`) are counted with their class.

| Column | Pattern |
|---|---|
| Palette | `text-`, `bg-`, `border-`, `from-`, `via-`, `to-`, `ring-`, `fill-`, `stroke-`, `divide-`, `outline-`, `placeholder-`, `shadow-`, `decoration-`, `accent-`, `caret-` followed by a Tailwind hue and a `50`–`950` step, e.g. `text-green-600`, `dark:bg-red-900/20` |
| B/W | `text-`, `bg-`, `border-`, `from-`, `via-`, `to-` followed by `white` or `black` |
| Hex | `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` literals |
| rgb() | `rgb(` and `rgba(` calls |

The `text-` and `bg-` palette classes alone come to 559 (`grep -rhoE
"(text|bg)-(<hue>)-[0-9]{2,3}" components app | wc -l`); the issue plan's
"about 264" counted a narrower set.

## Totals

| Kind | Count |
|---|---|
| Palette classes | 662 |
| `white` / `black` classes | 80 |
| Hex literals | 83 |
| `rgb(` / `rgba(` | 20 |
| **Total** | **845**, in 85 files |

By directory: `app/[lang]` 258, `components/admin` 172, `components/ui` 90,
`components/news` 80, `app/api` 43 (Open Graph image routes, which render
outside the stylesheet and need literal colours), `components/seo` 39,
`components/contact` 35, `components/auth` 31, `components/layout` 26,
`components/ranking` 23, root error and not-found pages 28, `app/globals.css` 11, other 9.
`app/globals.css` holds the 11 `rgb(` values of the existing `--shadow-*`
variables.

## Most-used palette classes

| Class | Uses | Token that covers it |
|---|---|---|
| `text-green-600` | 36 | `--ds-success` (or `--ds-rank-up`) |
| `text-gray-600` | 32 | `--ds-text-muted` |
| `text-red-600` | 29 | `--ds-danger` (or `--ds-rank-down`) |
| `bg-gray-200` | 27 | `--ds-surface-muted` / `--ds-border` |
| `text-green-500` | 20 | `--ds-success` |
| `text-gray-500` | 18 | `--ds-text-muted` |
| `bg-green-50` | 16 | `--ds-success-subtle` |
| `bg-green-500` | 15 | `--ds-success` |
| `border-green-200` | 15 | `--ds-border` on a `--ds-success-subtle` surface |
| `text-green-800` | 15 | `--ds-success` |
| `text-blue-600` | 15 | `--ds-accent` |
| `bg-gray-100` | 13 | `--ds-surface-muted` |
| `bg-red-50` | 13 | `--ds-danger-subtle` |
| `text-blue-500` | 13 | `--ds-accent` |
| `bg-gray-50` | 12 | `--ds-surface-muted` |
| `bg-blue-500` | 12 | `--ds-accent` |
| `border-gray-200` | 11 | `--ds-border` |
| `text-yellow-500` | 11 | `--ds-warning` |

`lib/ranking-utils.ts` (outside the scan) builds the tier badges from
gradients (`from-yellow-500 to-amber-500`, …) with white text; white on `yellow-500` is 1.92:1 and on `amber-500` 2.15:1. The `--ds-score-*` bands replace them.

## Per file

| File | Palette | B/W | Hex | rgb() | Total |
|---|---|---|---|---|---|
| `components/admin/generation-stats.tsx` | 57 | 3 | 0 | 0 | 60 |
| `app/[lang]/whats-new/recent/page.tsx` | 42 | 0 | 0 | 0 | 42 |
| `components/contact/contact-form.tsx` | 35 | 0 | 0 | 0 | 35 |
| `components/news/metric-impact-display.tsx` | 33 | 0 | 0 | 0 | 33 |
| `app/[lang]/(authenticated)/clerk-debug/page.tsx` | 23 | 8 | 0 | 0 | 31 |
| `components/ui/whats-new-modal.tsx` | 30 | 0 | 0 | 0 | 30 |
| `components/admin/unified-admin-dashboard.tsx` | 21 | 0 | 4 | 0 | 25 |
| `components/layout/footer.tsx` | 3 | 21 | 0 | 0 | 24 |
| `app/[lang]/(authenticated)/unauthorized/page.tsx` | 20 | 3 | 0 | 0 | 23 |
| `components/admin/rankings-viewer.tsx` | 22 | 0 | 0 | 0 | 22 |
| `components/ui/tool-icon.tsx` | 18 | 2 | 0 | 0 | 20 |
| `components/admin/news-ingestion-tool.tsx` | 19 | 0 | 0 | 0 | 19 |
| `components/seo/tool-overview.tsx` | 17 | 0 | 0 | 0 | 17 |
| `components/ranking/tier-legend.tsx` | 10 | 5 | 0 | 0 | 15 |
| `app/api/og/ranking/route.tsx` | 0 | 0 | 14 | 0 | 14 |
| `app/api/og/tool/route.tsx` | 0 | 0 | 14 | 0 | 14 |
| `components/news/article-scoring-impact.tsx` | 14 | 0 | 0 | 0 | 14 |
| `components/news/news-card.tsx` | 14 | 0 | 0 | 0 | 14 |
| `components/news/news-content.tsx` | 14 | 0 | 0 | 0 | 14 |
| `app/[lang]/(authenticated)/dashboard/rankings/[period]/changes/ranking-changes-summary.tsx` | 13 | 0 | 0 | 0 | 13 |
| `components/ui/status-indicator.tsx` | 13 | 0 | 0 | 0 | 13 |
| `app/[lang]/(authenticated)/dashboard/auth/error/page.tsx` | 10 | 2 | 0 | 0 | 12 |
| `components/ui/changelog-modal.tsx` | 12 | 0 | 0 | 0 | 12 |
| `app/[lang]/(authenticated)/admin/automated-ingestion/automated-ingestion-client.tsx` | 11 | 0 | 0 | 0 | 11 |
| `app/globals.css` | 0 | 0 | 0 | 11 | 11 |
| `components/admin/admin-dashboard.tsx` | 10 | 1 | 0 | 0 | 11 |
| `components/auth/no-auth-provider.tsx` | 9 | 2 | 0 | 0 | 11 |
| `components/seo/quick-answer-box.tsx` | 11 | 0 | 0 | 0 | 11 |
| `app/error.tsx` | 0 | 0 | 8 | 2 | 10 |
| `components/admin/rankings-manager.tsx` | 10 | 0 | 0 | 0 | 10 |
| `app/[lang]/(authenticated)/admin/whats-new-summary/whats-new-summary-client.tsx` | 9 | 0 | 0 | 0 | 9 |
| `app/[lang]/not-found.tsx` | 0 | 0 | 7 | 2 | 9 |
| `app/global-error.tsx` | 0 | 0 | 7 | 2 | 9 |
| `app/not-found.tsx` | 0 | 0 | 7 | 2 | 9 |
| `components/seo/seo-dashboard.tsx` | 9 | 0 | 0 | 0 | 9 |
| `app/[lang]/(authenticated)/admin/state-of-ai/state-of-ai-client.tsx` | 8 | 0 | 0 | 0 | 8 |
| `app/[lang]/best-code-review-tools/page.tsx` | 6 | 2 | 0 | 0 | 8 |
| `app/[lang]/best-devops-assistants/page.tsx` | 6 | 2 | 0 | 0 | 8 |
| `app/[lang]/best-ide-assistants/page.tsx` | 6 | 2 | 0 | 0 | 8 |
| `app/[lang]/best-open-source-frameworks/page.tsx` | 6 | 2 | 0 | 0 | 8 |
| `app/[lang]/best-testing-tools/page.tsx` | 6 | 2 | 0 | 0 | 8 |
| `app/[lang]/page.tsx` | 7 | 1 | 0 | 0 | 8 |
| `app/api/contact/route.ts` | 0 | 0 | 8 | 0 | 8 |
| `components/ui/signup-for-updates-modal.tsx` | 8 | 0 | 0 | 0 | 8 |
| `app/[lang]/best-ai-app-builders/page.tsx` | 5 | 2 | 0 | 0 | 7 |
| `app/[lang]/best-ai-code-editors/page.tsx` | 5 | 2 | 0 | 0 | 7 |
| `app/[lang]/best-autonomous-agents/page.tsx` | 5 | 2 | 0 | 0 | 7 |
| `app/[lang]/client-rankings-optimized.tsx` | 7 | 0 | 0 | 0 | 7 |
| `app/api/og/route.tsx` | 0 | 0 | 7 | 0 | 7 |
| `components/admin/article-management.tsx` | 4 | 3 | 0 | 0 | 7 |
| `components/auth/clerk-header.tsx` | 5 | 2 | 0 | 0 | 7 |
| `components/admin/character-counter.tsx` | 6 | 0 | 0 | 0 | 6 |
| `app/[lang]/best-ai-coding-tools/page.tsx` | 3 | 2 | 0 | 0 | 5 |
| `components/admin/back-to-website-nav.tsx` | 0 | 0 | 5 | 0 | 5 |
| `components/admin/tools-manager.tsx` | 5 | 0 | 0 | 0 | 5 |
| `components/news/news-detail-content.tsx` | 5 | 0 | 0 | 0 | 5 |
| `app/[lang]/(authenticated)/dashboard/tools/[slug]/dashboard-tool-detail.tsx` | 4 | 0 | 0 | 0 | 4 |
| `components/ranking/rankings-content.tsx` | 4 | 0 | 0 | 0 | 4 |
| `components/ranking/rankings-grid.tsx` | 4 | 0 | 0 | 0 | 4 |
| `components/whats-new/whats-new-navigation.tsx` | 4 | 0 | 0 | 0 | 4 |
| `app/[lang]/(authenticated)/admin/news/edit/[id]/page.tsx` | 2 | 1 | 0 | 0 | 3 |
| `app/[lang]/client-rankings.tsx` | 3 | 0 | 0 | 0 | 3 |
| `app/[lang]/layout.tsx` | 3 | 0 | 0 | 0 | 3 |
| `components/auth/auth-components-simple.tsx` | 3 | 0 | 0 | 0 | 3 |
| `components/error-boundary.tsx` | 1 | 2 | 0 | 0 | 3 |
| `app/[lang]/(authenticated)/admin/news/new/page.tsx` | 2 | 0 | 0 | 0 | 2 |
| `app/[lang]/(authenticated)/dashboard/cache/cache-client.tsx` | 2 | 0 | 0 | 0 | 2 |
| `components/admin/image-uploader.tsx` | 2 | 0 | 0 | 0 | 2 |
| `components/auth/clerk-debug.tsx` | 0 | 2 | 0 | 0 | 2 |
| `components/auth/clerk-direct-components.tsx` | 2 | 0 | 0 | 0 | 2 |
| `components/auth/no-auth-header.tsx` | 2 | 0 | 0 | 0 | 2 |
| `components/auth/user-button-with-admin.tsx` | 1 | 0 | 0 | 1 | 2 |
| `components/dynamic-imports/DynamicCharts.tsx` | 2 | 0 | 0 | 0 | 2 |
| `components/layout/markdown-layout.tsx` | 1 | 1 | 0 | 0 | 2 |
| `components/seo/comparison-table.tsx` | 2 | 0 | 0 | 0 | 2 |
| `components/ui/tech-stack-modal.tsx` | 2 | 0 | 0 | 0 | 2 |
| `app/[lang]/(authenticated)/dashboard/rankings/page.tsx` | 1 | 0 | 0 | 0 | 1 |
| `app/[lang]/(authenticated)/layout.tsx` | 0 | 0 | 1 | 0 | 1 |
| `components/auth/clerk-provider-client.tsx` | 0 | 0 | 1 | 0 | 1 |
| `components/auth/user-profile-dropdown.tsx` | 1 | 0 | 0 | 0 | 1 |
| `components/ui/alert-dialog.tsx` | 0 | 1 | 0 | 0 | 1 |
| `components/ui/crown-icon.tsx` | 1 | 0 | 0 | 0 | 1 |
| `components/ui/dialog.tsx` | 0 | 1 | 0 | 0 | 1 |
| `components/ui/optimized-image.tsx` | 1 | 0 | 0 | 0 | 1 |
| `components/ui/sidebar.tsx` | 0 | 1 | 0 | 0 | 1 |
