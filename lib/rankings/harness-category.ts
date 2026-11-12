/**
 * #196: the categories `?category=` filters the harness board by.
 *
 * The values the #191 URL table's `/rankings/coding-harnesses?category=` rows name, in the
 * URL (hyphen) form of a `tools.subcategory` value (Architect ruling 20:12Z; Q-A4: the
 * column stores underscores, URLs use hyphens). A value outside this list is unknown.
 */
export const HARNESS_CATEGORIES = [
  "app-builder",
  "autonomous-agent",
  "code-editor",
  "code-review",
  "devops-assistant",
  "ide-assistant",
  "open-source-framework",
  "testing-tool",
] as const;
export type HarnessCategory = (typeof HARNESS_CATEGORIES)[number];

const CATEGORY_SET: ReadonlySet<string> = new Set(HARNESS_CATEGORIES);

/** #196 PURE: `value` as a known harness category, or null (absent, empty or unknown: the unfiltered board). */
export function harnessCategory(value: string | null | undefined): HarnessCategory | null {
  return value && CATEGORY_SET.has(value) ? (value as HarnessCategory) : null;
}

/** #196 PURE: the `tools.subcategory` value a URL category names: hyphens to underscores (`app-builder` -> `app_builder`, Q-A4). */
export function harnessSubcategory(category: HarnessCategory): string {
  return category.replace(/-/g, "_");
}

/**
 * #196 PURE: the rows whose `tool.subcategory` is `category`'s (`harnessSubcategory`), in board
 * order, ranks kept. `tool.category` is not read; a row with no subcategory is in no category.
 */
export function rowsInCategory<T extends { tool?: { subcategory?: string | null } }>(rows: readonly T[], category: HarnessCategory): T[] {
  const subcategory = harnessSubcategory(category);
  return rows.filter((row) => row.tool?.subcategory === subcategory);
}
