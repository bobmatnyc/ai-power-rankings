/**
 * #196: the categories `?category=` filters the harness board by.
 *
 * The values the #191 URL table's `/rankings/coding-harnesses?category=` rows name, each
 * equal to a `tools.category` value (the field the board rows carry as `tool.category`
 * and the client grid's filter reads). A value outside this list is unknown.
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

/** #196 PURE: the rows whose `tool.category` is `category`, in board order, ranks kept. */
export function rowsInCategory<T extends { tool?: { category?: string } }>(rows: readonly T[], category: HarnessCategory): T[] {
  return rows.filter((row) => row.tool?.category === category);
}
