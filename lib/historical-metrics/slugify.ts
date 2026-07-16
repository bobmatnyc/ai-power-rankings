/**
 * Slug derivation for the historical-metrics backfill.
 *
 * Why: the override files key each tool by its `slug`, and
 * `applyHistoricalMetricsOverride` matches on `tool.slug`. Both the generator
 * (which writes the files) and the dry-run roster (which reads them) must derive
 * slugs identically, so the rule lives here in one place.
 *
 * The rule matches the project's existing slug convention (see the placeholder
 * `data/json/tools/tools.json`: "GitHub Copilot" -> "github-copilot",
 * "Cursor" -> "cursor") and the validated POC ("Claude Code" -> "claude-code").
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * SLUG ALIAS MAP — display-name-derived slug -> live `tools.slug` override.
 *
 * `slugify(display_name)` is a best-effort derivation and does not always match
 * the live slug stored in the `tools` table: some live slugs carry a
 * disambiguating suffix (e.g. a vendor or product-line qualifier) that cannot be
 * recovered from the display name alone. A publish-time dry-check compares
 * override-file keys against live `tools.slug` values; every mismatch it finds
 * must be added here so regenerating the historical-metrics files keeps
 * producing keys the live loader (`applyHistoricalMetricsOverride`, which
 * matches on `tool.slug`) will actually match.
 *
 * Keep this list flat, alphabetized by derived slug, and append-only — never
 * repurpose an existing key for a different tool.
 */
export const SLUG_ALIASES: Record<string, string> = {
  continue: "continue-dev",
  "google-gemini-code-assist": "gemini-code-assist",
  "jetbrains-ai-assistant": "jetbrains-ai",
  v0: "v0-vercel",
};

/**
 * Resolves a display-name-derived slug to the live `tools.slug` value that
 * should be used as the override-file key, applying `SLUG_ALIASES` when the
 * derived slug is a known mismatch. Returns the derived slug unchanged
 * otherwise.
 */
export function resolveLiveSlug(derivedSlug: string): string {
  return SLUG_ALIASES[derivedSlug] ?? derivedSlug;
}
