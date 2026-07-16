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
