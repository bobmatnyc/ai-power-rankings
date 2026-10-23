/**
 * Old-colour to `--ds-*` token mapping tables for #190 migrations that cannot
 * be screenshotted (ruling D1: admin and auth pages).
 *
 * Why: the class-diff check (`scripts/design-class-diff.ts`), the per-mapping
 * pixel check (`scripts/design-parity-pixels.ts`) and the parity unit test
 * must all read the same table, or a substitution could pass one check
 * against a mapping the others never saw.
 * What: one `ClassMap` per migration set. `classes` maps a palette class to
 * its token class; a variant prefix (`hover:`, `dark:`, …) and an opacity
 * modifier (`/50`) carry over unchanged. `pairs` maps a light class and its
 * `dark:` class, written together, to one token class with both values.
 * `inline` maps an inline-style hex to the token's `hsl(var(--ds-…))` value.
 * `files` lists the set's files. Each old colour has exactly one target.
 * Test: `tests/unit/design-parity-190e2a.test.ts` checks every entry against
 * the palette and the token layer; `npx tsx scripts/design-class-diff.ts
 * --set 190e2a` checks the source against it.
 */

export interface ClassMap {
  /** Files the migration may change. */
  files: ReadonlyArray<string>;
  /** Palette class (no variant, no opacity) → token class. */
  classes: Readonly<Record<string, string>>;
  /** `"<light class> dark:<dark class>"` → token class carrying both values. */
  pairs: Readonly<Record<string, string>>;
  /** Inline-style hex (lower case) → `hsl(var(--ds-…))`. */
  inline: Readonly<Record<string, string>>;
}

/** #190 PR E2a: admin components and the SEO dashboard. */
const MAP_190E2A: ClassMap = {
  files: [
    "components/admin/generation-stats.tsx",
    "components/admin/unified-admin-dashboard.tsx",
    "components/admin/rankings-viewer.tsx",
    "components/admin/news-ingestion-tool.tsx",
    "components/admin/admin-dashboard.tsx",
    "components/admin/rankings-manager.tsx",
    "components/admin/article-management.tsx",
    "components/admin/character-counter.tsx",
    "components/admin/back-to-website-nav.tsx",
    "components/admin/tools-manager.tsx",
    "components/admin/image-uploader.tsx",
    "components/seo/seo-dashboard.tsx",
  ],
  classes: {
    // Neutral paper surfaces, borders and text (one value in both modes).
    "bg-white": "bg-ds-surface-paper",
    "bg-gray-50": "bg-ds-surface-paper-muted",
    "bg-gray-100": "bg-ds-surface-paper-sunken",
    "bg-gray-200": "bg-ds-surface-skeleton",
    "border-gray-200": "border-ds-border-paper",
    "text-gray-400": "text-ds-text-paper-faint",
    "text-gray-500": "text-ds-text-paper-subtle",
    "text-gray-600": "text-ds-text-paper-muted",
    "text-white": "text-ds-text-on-fill",
    "bg-black": "bg-ds-surface-overlay",
    // Success and danger (fixed: one value in both modes).
    "text-green-500": "text-ds-success-solid",
    "bg-green-500": "bg-ds-success-solid",
    "text-green-600": "text-ds-success-fixed-mid",
    "text-green-700": "text-ds-success-fixed",
    "bg-green-50": "bg-ds-success-fixed-subtle",
    "border-green-200": "border-ds-success-fixed-border",
    "text-red-600": "text-ds-danger-fixed",
    "bg-red-500": "bg-ds-danger-solid",
    "bg-red-50": "bg-ds-danger-fixed-subtle",
    "border-red-200": "border-ds-danger-fixed-border",
    // Category accents.
    "text-blue-600": "text-ds-accent-fixed",
    "bg-blue-500": "bg-ds-accent-cat-blue",
    "text-yellow-500": "text-ds-accent-cat-yellow",
    "bg-yellow-500": "bg-ds-accent-cat-yellow",
    "text-yellow-600": "text-ds-accent-cat-yellow-strong",
    "bg-orange-500": "bg-ds-accent-cat-orange",
    "text-orange-600": "text-ds-accent-cat-orange-strong",
    "bg-purple-500": "bg-ds-accent-cat-purple",
  },
  pairs: {
    "text-red-600 dark:text-red-400": "text-ds-text-callout-danger",
    "text-green-600 dark:text-green-400": "text-ds-text-callout-success",
  },
  inline: {
    "#3b82f6": "hsl(var(--ds-accent-cat-blue))",
    "#ef4444": "hsl(var(--ds-danger-solid))",
    "#e5e7eb": "hsl(var(--ds-border-paper))",
    "#f0fdf4": "hsl(var(--ds-success-fixed-subtle))",
    "#22c55e": "hsl(var(--ds-success-solid))",
    "#16a34a": "hsl(var(--ds-success-fixed-mid))",
  },
};

export const CLASS_MAPS: Readonly<Record<string, ClassMap>> = { "190e2a": MAP_190E2A };
