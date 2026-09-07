/**
 * Behaviour matrix for the generate-categories build step.
 *
 * Why: #143 — `npm run build` runs `generate-categories` first. With no
 * DATABASE_URL the old script read zero categories, rewrote
 * `lib/data/static-categories.ts` down to a single "All Categories" entry with a
 * fresh `Generated:` timestamp and exited 0, so a developer who built locally
 * and committed wiped 57 lines of real data behind a routine-looking diff.
 * What: Drives `decideStaticCategories` through every row of the matrix with
 * injected dependencies — no database, no filesystem — and pins that the three
 * non-writing rows never call `writeFile`. Two wrong implementations must fail
 * here: the old script (writes on an empty read and exits 0) and one that exits
 * 1 on an empty read but has already written the file.
 * Test: `npm run test:unit`.
 */

import { describe, expect, it, vi } from "vitest";
import {
  buildStaticCategoriesFile,
  countCategories,
  decideStaticCategories,
  getCategoryName,
  redactConnectionUrls,
  type Category,
  type CategoryFetchResult,
  type GenerateCategoriesDeps,
} from "../../lib/data/static-categories-generator";
// Imported instead of lib/db/connection so the test runs no dotenv load and
// depends on no .env* file existing. connection.ts's getDatabaseUrl() and its
// exported hasUsableDatabaseUrl() are both thin wrappers over resolveDatabaseUrl.
import { describeDatabaseUrlResolution, resolveDatabaseUrl } from "../../lib/db/database-url";

const REAL_CATEGORIES: Category[] = [
  { id: "ide-assistant", name: "Ide Assistant", count: 11 },
  { id: "autonomous-agent", name: "Autonomous Agent", count: 10 },
];

const NON_EMPTY_READ: CategoryFetchResult = { categories: REAL_CATEGORIES, toolCount: 51 };
const EMPTY_READ: CategoryFetchResult = { categories: [], toolCount: 0 };

/** Builds the dependency bundle with spies, overridden per matrix row. */
function makeDeps(overrides: Partial<GenerateCategoriesDeps> = {}) {
  const writeFile = vi.fn<(contents: string) => void>();
  const log = vi.fn<(message: string) => void>();
  const logError = vi.fn<(message: string) => void>();
  const deps: GenerateCategoriesDeps = {
    hasDatabaseUrl: true,
    allowEmpty: false,
    fetchCategories: vi.fn(async () => NON_EMPTY_READ),
    writeFile,
    log,
    logError,
    ...overrides,
  };
  return { deps, writeFile, log, logError };
}

describe("decideStaticCategories behaviour matrix", () => {
  it("skips regeneration and keeps the committed file when DATABASE_URL is unset", async () => {
    const fetchCategories = vi.fn(async () => EMPTY_READ);
    const { deps, writeFile, log, logError } = makeDeps({
      hasDatabaseUrl: false,
      fetchCategories,
    });

    const exitCode = await decideStaticCategories(deps);

    expect(exitCode).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
    expect(fetchCategories).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toContain("No DATABASE_URL is set for this NODE_ENV");
    expect(log.mock.calls[0]?.[0]).toContain("lib/data/static-categories.ts");
  });

  it("fails without writing when the connection or query throws", async () => {
    const { deps, writeFile, logError } = makeDeps({
      fetchCategories: vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    });

    const exitCode = await decideStaticCategories(deps);

    expect(exitCode).toBe(1);
    expect(writeFile).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0]?.[0]).toContain("connect ECONNREFUSED");
  });

  it("redacts a connection string carried in the error message", async () => {
    const { deps, writeFile, logError } = makeDeps({
      fetchCategories: vi.fn(async () => {
        throw new Error(
          "getaddrinfo ENOTFOUND for postgresql://user:hunter2@db.example.com/main?sslmode=require"
        );
      }),
    });

    const exitCode = await decideStaticCategories(deps);
    const message = logError.mock.calls[0]?.[0] ?? "";

    expect(exitCode).toBe(1);
    expect(writeFile).not.toHaveBeenCalled();
    expect(message).not.toContain("hunter2");
    expect(message).not.toContain("postgresql://");
    expect(message).toContain("[redacted-connection-url]");
  });

  it("fails without writing when the query returns zero categories", async () => {
    const { deps, writeFile, logError } = makeDeps({
      allowEmpty: false,
      fetchCategories: vi.fn(async () => EMPTY_READ),
    });

    const exitCode = await decideStaticCategories(deps);

    expect(exitCode).toBe(1);
    expect(writeFile).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0]?.[0]).toContain("0 categories");
    expect(logError.mock.calls[0]?.[0]).toContain("--allow-empty");
  });

  it("writes the empty result and succeeds when --allow-empty is passed", async () => {
    const { deps, writeFile, logError } = makeDeps({
      allowEmpty: true,
      fetchCategories: vi.fn(async () => EMPTY_READ),
    });

    const exitCode = await decideStaticCategories(deps);

    expect(exitCode).toBe(0);
    expect(logError).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile.mock.calls[0]?.[0]).toContain('"id": "all"');
  });

  it("writes the generated module when the query returns categories", async () => {
    const { deps, writeFile, log, logError } = makeDeps({
      fetchCategories: vi.fn(async () => NON_EMPTY_READ),
    });

    const exitCode = await decideStaticCategories(deps);
    const contents = writeFile.mock.calls[0]?.[0] ?? "";

    expect(exitCode).toBe(0);
    expect(logError).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(contents).toContain("export const STATIC_CATEGORIES");
    expect(contents).toContain('"id": "ide-assistant"');
    expect(contents).toContain('"count": 51');
    expect(log.mock.calls[0]?.[0]).toContain("Wrote 2 categories from 51 tools");
  });
});

describe("the guard resolves the database URL through getDb()'s own rules", () => {
  // The CLI wires `hasDatabaseUrl: hasUsableDatabaseUrl()`, which is
  // `resolveDatabaseUrl(process.env, NODE_ENV).url !== undefined`. These rows
  // compose the same two functions over an injected environment, so no
  // process.env mutation and no .env* file is involved.
  function guardFor(env: Record<string, string | undefined>, nodeEnv: string): boolean {
    return resolveDatabaseUrl(env, nodeEnv).url !== undefined;
  }

  it("skips when only DATABASE_URL_STAGING is set under NODE_ENV=production", async () => {
    const env = { DATABASE_URL_STAGING: "postgres://staging.example.com/db" };
    const fetchCategories = vi.fn(async () => NON_EMPTY_READ);
    const { deps, writeFile, log } = makeDeps({
      hasDatabaseUrl: guardFor(env, "production"),
      fetchCategories,
    });

    const exitCode = await decideStaticCategories(deps);

    // Before #143's review follow-up the guard ORed all three variables, so this
    // environment reached getDb(), which reads DATABASE_URL only in production,
    // and the build died at exit 1 instead of skipping.
    expect(exitCode).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
    expect(fetchCategories).not.toHaveBeenCalled();
    expect(log.mock.calls[0]?.[0]).toContain("No DATABASE_URL is set for this NODE_ENV");
  });

  it("proceeds when DATABASE_URL is set under NODE_ENV=production", async () => {
    const env = { DATABASE_URL: "postgres://prod.example.com/db" };
    const fetchCategories = vi.fn(async () => NON_EMPTY_READ);
    const { deps, writeFile } = makeDeps({
      hasDatabaseUrl: guardFor(env, "production"),
      fetchCategories,
    });

    const exitCode = await decideStaticCategories(deps);

    expect(exitCode).toBe(0);
    expect(fetchCategories).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });
});

describe("resolveDatabaseUrl", () => {
  it("reads DATABASE_URL only in production, ignoring the branch variables", () => {
    expect(
      resolveDatabaseUrl({ DATABASE_URL_STAGING: "postgres://s/db" }, "production")
    ).toEqual({});
    expect(
      resolveDatabaseUrl({ DATABASE_URL_DEVELOPMENT: "postgres://d/db" }, "production")
    ).toEqual({});
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://p/db" }, "production")).toEqual({
      url: "postgres://p/db",
      variable: "DATABASE_URL",
    });
  });

  it("prefers the branch variable in development and staging, then falls back", () => {
    expect(
      resolveDatabaseUrl(
        { DATABASE_URL_DEVELOPMENT: "postgres://d/db", DATABASE_URL: "postgres://p/db" },
        "development"
      ).variable
    ).toBe("DATABASE_URL_DEVELOPMENT");
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://p/db" }, "development").variable).toBe(
      "DATABASE_URL"
    );
    expect(
      resolveDatabaseUrl(
        { DATABASE_URL_STAGING: "postgres://s/db", DATABASE_URL: "postgres://p/db" },
        "staging"
      ).variable
    ).toBe("DATABASE_URL_STAGING");
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://p/db" }, "staging").variable).toBe(
      "DATABASE_URL"
    );
  });

  it("treats the .env.example placeholder and an empty value as unconfigured", () => {
    expect(
      resolveDatabaseUrl({ DATABASE_URL: "postgres://u:YOUR_PASSWORD@h/db" }, "production")
    ).toEqual({});
    expect(resolveDatabaseUrl({ DATABASE_URL: "" }, "production")).toEqual({});
    expect(resolveDatabaseUrl({}, "development")).toEqual({});
  });

  it("keeps the log line getDb() printed for each resolution", () => {
    expect(describeDatabaseUrlResolution("development", "DATABASE_URL_DEVELOPMENT")).toContain(
      "Using DATABASE_URL_DEVELOPMENT (development branch)"
    );
    expect(describeDatabaseUrlResolution("development", "DATABASE_URL")).toContain(
      "DATABASE_URL_DEVELOPMENT not found, falling back to DATABASE_URL"
    );
    expect(describeDatabaseUrlResolution("staging", "DATABASE_URL_STAGING")).toContain(
      "Using DATABASE_URL_STAGING (staging branch)"
    );
    expect(describeDatabaseUrlResolution("production", "DATABASE_URL")).toContain(
      "Using DATABASE_URL (production branch)"
    );
  });
});

describe("buildStaticCategoriesFile", () => {
  it("prepends the All Categories entry carrying the tool count", () => {
    const contents = buildStaticCategoriesFile(NON_EMPTY_READ, new Date("2026-01-02T03:04:05.000Z"));

    expect(contents).toContain("Generated: 2026-01-02T03:04:05.000Z");
    expect(contents.indexOf('"id": "all"')).toBeLessThan(contents.indexOf('"id": "ide-assistant"'));
  });

  it("emits a module the runtime consumers can still import when empty", () => {
    const contents = buildStaticCategoriesFile(EMPTY_READ, new Date("2026-01-02T03:04:05.000Z"));

    expect(contents).toContain("export interface Category");
    expect(contents).toContain('"name": "All Categories"');
  });
});

describe("countCategories", () => {
  it("counts a bare array of rankings, most-populated category first", () => {
    const result = countCategories([
      { tool: { category: "ide-assistant" } },
      { category: "code-editor" },
      { tool: { category: "ide-assistant" } },
    ]);

    expect(result.toolCount).toBe(3);
    expect(result.categories).toEqual([
      { id: "ide-assistant", name: "Ide Assistant", count: 2 },
      { id: "code-editor", name: "Code Editor", count: 1 },
    ]);
  });

  it("reads the rankings and data wrappers the JSONB column also uses", () => {
    expect(countCategories({ rankings: [{ category: "other" }] }).categories).toHaveLength(1);
    expect(countCategories({ data: [{ category: "other" }] }).categories).toHaveLength(1);
  });

  it("returns an empty result for a missing or unrecognised payload", () => {
    for (const payload of [undefined, null, {}, "not-json", 42]) {
      expect(countCategories(payload)).toEqual({ categories: [], toolCount: 0 });
    }
  });

  it("ignores entries with no usable category but still counts them as tools", () => {
    const result = countCategories([{ tool: {} }, { category: "" }, { category: "other" }]);

    expect(result.toolCount).toBe(3);
    expect(result.categories).toEqual([{ id: "other", name: "Other", count: 1 }]);
  });
});

describe("helpers", () => {
  it("title-cases a hyphenated category id", () => {
    expect(getCategoryName("open-source-framework")).toBe("Open Source Framework");
  });

  it("redacts both postgres and postgresql URLs", () => {
    expect(redactConnectionUrls("postgres://a:b@h/db and postgresql://c:d@h/db")).toBe(
      "[redacted-connection-url] and [redacted-connection-url]"
    );
  });
});
