/**
 * Static Categories Generation — decision core
 *
 * Why: `npm run build` runs `generate-categories` before `next build`. The old
 * script treated "no DATABASE_URL" and "the query failed" as ordinary results:
 * it substituted a single "All Categories" placeholder, rewrote
 * `lib/data/static-categories.ts` with a fresh `Generated:` timestamp and exited
 * 0. A developer who built locally and committed therefore wiped 57 lines of
 * category data behind a diff that looked routine (#143).
 * What: Holds the write/skip/fail decision as a pure async function over
 * injected dependencies, together with the JSONB category counting, the
 * file-content builder and the connection-string redactor it needs. Touches no
 * filesystem, no database, no `process.env` and no `process.exit`, so every
 * branch is reachable from a unit test with no database.
 * Test: `tests/unit/generate-static-categories.test.ts`.
 */

/** One entry of the generated `STATIC_CATEGORIES` array. */
export interface Category {
  id: string;
  name: string;
  count: number;
}

/** What a successful read of the rankings snapshot yields. */
export interface CategoryFetchResult {
  /** Real categories, excluding the synthetic "All Categories" entry. */
  categories: Category[];
  /** Number of ranked tools those categories were counted from. */
  toolCount: number;
}

/**
 * Everything `decideStaticCategories` is allowed to touch. The CLI supplies the
 * real implementations; tests supply spies.
 */
export interface GenerateCategoriesDeps {
  /** Whether a database connection string is configured in the environment. */
  hasDatabaseUrl: boolean;
  /** `--allow-empty`: permit a zero-category read to overwrite the file. */
  allowEmpty: boolean;
  /** Reads the current rankings snapshot. May reject. */
  fetchCategories: () => Promise<CategoryFetchResult>;
  /** Writes the generated module. Must be atomic in the real implementation. */
  writeFile: (contents: string) => void;
  log: (message: string) => void;
  logError: (message: string) => void;
}

export const OUTPUT_RELATIVE_PATH = "lib/data/static-categories.ts";

const ALL_CATEGORIES_ID = "all";
const ALL_CATEGORIES_NAME = "All Categories";

const LOG_PREFIX = "[Generate Categories]";

/**
 * Matches a Postgres connection string so a driver error cannot carry
 * credentials into a build log. A connection string never contains whitespace.
 */
const CONNECTION_URL_PATTERN = /postgres(?:ql)?:\/\/\S+/gi;

/** Replaces every `postgres://` / `postgresql://` URL in `message`. */
export function redactConnectionUrls(message: string): string {
  return message.replace(CONNECTION_URL_PATTERN, "[redacted-connection-url]");
}

/** Turns a category id such as `ide-assistant` into `Ide Assistant`. */
export function getCategoryName(categoryId: string): string {
  return categoryId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Pulls the ranking entries out of the several shapes the JSONB column takes. */
function toRankingsArray(rankingsData: unknown): unknown[] {
  if (Array.isArray(rankingsData)) {
    return rankingsData;
  }
  if (rankingsData && typeof rankingsData === "object") {
    const record = rankingsData as Record<string, unknown>;
    if (Array.isArray(record["rankings"])) {
      return record["rankings"];
    }
    if (Array.isArray(record["data"])) {
      return record["data"];
    }
  }
  return [];
}

/** Reads the category of one ranking entry, top-level or nested under `tool`. */
function readCategory(ranking: unknown): string | null {
  if (!ranking || typeof ranking !== "object") {
    return null;
  }
  const record = ranking as Record<string, unknown>;
  const tool = record["tool"];
  const nested =
    tool && typeof tool === "object" ? (tool as Record<string, unknown>)["category"] : undefined;
  const category = nested ?? record["category"];
  return typeof category === "string" && category.length > 0 ? category : null;
}

/**
 * Counts tools per category in the rankings JSONB payload, most-populated first.
 *
 * Why: #143 — an unreadable or empty payload must produce an empty result the
 * caller can refuse to write, not a placeholder that looks like a real read.
 * What: Returns the real categories only; the synthetic "All Categories" entry
 * is added by `buildStaticCategoriesFile`, so `categories.length === 0` means
 * exactly "nothing was read".
 * Test: `tests/unit/generate-static-categories.test.ts`.
 */
export function countCategories(rankingsData: unknown): CategoryFetchResult {
  const rankingsArray = toRankingsArray(rankingsData);
  const categoryCounts = new Map<string, number>();

  for (const ranking of rankingsArray) {
    const category = readCategory(ranking);
    if (category) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  const categories: Category[] = [...categoryCounts.entries()]
    .map(([id, count]) => ({ id, name: getCategoryName(id), count }))
    .sort((a, b) => b.count - a.count);

  return { categories, toolCount: rankingsArray.length };
}

/** Renders the generated `lib/data/static-categories.ts` module source. */
export function buildStaticCategoriesFile(
  result: CategoryFetchResult,
  generatedAt: Date = new Date()
): string {
  const entries: Category[] = [
    { id: ALL_CATEGORIES_ID, name: ALL_CATEGORIES_NAME, count: result.toolCount },
    ...result.categories,
  ];

  return `/**
 * Static Categories Data
 * Generated at build time from database
 *
 * DO NOT EDIT MANUALLY
 * Run 'npm run generate-categories' to update this file
 *
 * Generated: ${generatedAt.toISOString()}
 */

export interface Category {
  id: string;
  name: string;
  count: number;
}

export const STATIC_CATEGORIES: Category[] = ${JSON.stringify(entries, null, 2)};
`;
}

/**
 * Decides whether to rewrite the committed static-categories module.
 *
 * Why: The generated file is real committed data that `app/[lang]/layout.tsx`
 * and `app/[lang]/page.tsx` render at request time. Overwriting it is only
 * correct when a database actually answered with categories; every other
 * outcome must leave the file alone so a local `npm run build` cannot silently
 * delete it (#143).
 * What: Pure over its injected dependencies and returns the process exit code.
 * `writeFile` is called on exactly two paths — a non-empty read, and an empty
 * read with `allowEmpty` — and never otherwise.
 * Test: `tests/unit/generate-static-categories.test.ts`.
 */
export async function decideStaticCategories(deps: GenerateCategoriesDeps): Promise<number> {
  if (!deps.hasDatabaseUrl) {
    deps.log(
      `${LOG_PREFIX} DATABASE_URL is not set — skipping regeneration and keeping the committed ${OUTPUT_RELATIVE_PATH}.`
    );
    return 0;
  }

  let result: CategoryFetchResult;
  try {
    result = await deps.fetchCategories();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.logError(
      `${LOG_PREFIX} Failed to read categories: ${redactConnectionUrls(message)}. ${OUTPUT_RELATIVE_PATH} left untouched.`
    );
    return 1;
  }

  if (result.categories.length === 0) {
    if (!deps.allowEmpty) {
      deps.logError(
        `${LOG_PREFIX} Read 0 categories from the database — ${OUTPUT_RELATIVE_PATH} left untouched. Re-run with --allow-empty if an empty file is genuinely intended.`
      );
      return 1;
    }
    deps.log(
      `${LOG_PREFIX} Read 0 categories — writing an empty result because --allow-empty was passed.`
    );
    deps.writeFile(buildStaticCategoriesFile(result));
    return 0;
  }

  deps.writeFile(buildStaticCategoriesFile(result));
  deps.log(
    `${LOG_PREFIX} Wrote ${result.categories.length} categories from ${result.toolCount} tools to ${OUTPUT_RELATIVE_PATH}.`
  );
  return 0;
}
