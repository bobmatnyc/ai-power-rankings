/**
 * #196: the harness board's `?category=` filter reads the `tools.subcategory` column, on PGlite.
 *
 * Why: Architect ruling 20:12Z — `?category=<v>` filters on `tools.subcategory` (underscore
 *   form), not `tools.category`. Six live harnesses (flint, factory, baz, junie, gas-town,
 *   epic) have `category = 'other'` and a set subcategory; the first five must land on their
 *   subcategory's page. A tool with no subcategory is on no category page but on the board.
 * What: the real ToolsRepository over a PGlite `tools` table (fixture rows are inserted with
 *   `category = 'other'`), the real `loadCurrentRankings()` with the rankings repository
 *   stubbed to one harness snapshot, then `rowsInCategory` for each known category.
 * Test: `npx vitest run tests/unit/rankings-category-pglite-196.test.ts`. No server, no network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkedDb } from "./fixtures/tool-links-183-fixture";

const { getDb, holder } = vi.hoisted(() => {
  const holder = { db: null as unknown };
  return { getDb: vi.fn(() => holder.db), holder };
});
vi.mock("../../lib/db/connection", () => ({ getDb }));

/** Slug -> subcategory column (null: unset). Every row's `category` column is `other`. */
const SUBCATEGORY: Readonly<Record<string, string | null>> = {
  flint: "app_builder",
  factory: "autonomous_agent",
  baz: "code_review",
  junie: "ide_assistant",
  "gas-town": "open_source_framework",
  epic: "code_assistant",
  cursor: "code_editor",
  "no-subcategory": null,
};
const SLUGS = Object.keys(SUBCATEGORY);

vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    getCurrentRankings: async (list: string) =>
      list === "harness"
        ? {
            id: "harness-2026-11",
            period: "2026-11",
            list: "harness",
            algorithm_version: "8.1",
            is_current: true,
            published_at: new Date("2026-11-01T00:00:00Z"),
            created_at: new Date("2026-11-01T00:00:00Z"),
            data: SLUGS.map((slug, i) => ({ tool_slug: slug, rank: i + 1, score: 90 - i })),
          }
        : null,
  },
}));

import { loadCurrentRankings } from "../../lib/rankings/current-rankings";
import { HARNESS_CATEGORIES, rowsInCategory } from "../../lib/rankings/harness-category";

vi.setConfig({ testTimeout: 60_000 });

let pg: PGlite;
beforeEach(async () => {
  let db: unknown;
  ({ pg, db } = await linkedDb(SLUGS.map((slug) => ({ slug, name: slug, kind: "harness" as const }))));
  for (const [slug, subcategory] of Object.entries(SUBCATEGORY)) {
    await pg.query(`UPDATE public."tools" SET subcategory = $1 WHERE slug = $2`, [subcategory, slug]);
  }
  holder.db = db;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  await pg.close();
});

async function board() {
  return (await loadCurrentRankings("harness"))!.rankings;
}

describe("#196 the category filter on the tools.subcategory column", () => {
  it("each board row carries its subcategory column, with category 'other'", async () => {
    const rows = await board();
    expect(rows.map((r) => [r.tool.slug, r.tool.category, r.tool.subcategory])).toEqual(
      SLUGS.map((slug) => [slug, "other", SUBCATEGORY[slug]])
    );
  });

  it("the category='other' tools land on their subcategory's page; epic (code_assistant) is on none", async () => {
    const rows = await board();
    const pages = Object.fromEntries(HARNESS_CATEGORIES.map((c) => [c, rowsInCategory(rows, c).map((r) => r.tool.slug)]));
    expect(pages).toEqual({
      "app-builder": ["flint"],
      "autonomous-agent": ["factory"],
      "code-editor": ["cursor"],
      "code-review": ["baz"],
      "devops-assistant": [],
      "ide-assistant": ["junie"],
      "open-source-framework": ["gas-town"],
      "testing-tool": [],
    });
  });

  it("a tool with a null subcategory is on no category page but on the unfiltered board", async () => {
    const rows = await board();
    expect(rows.map((r) => r.tool.slug)).toContain("no-subcategory");
    for (const category of HARNESS_CATEGORIES) {
      expect(rowsInCategory(rows, category).map((r) => r.tool.slug), category).not.toContain("no-subcategory");
    }
  });
});
