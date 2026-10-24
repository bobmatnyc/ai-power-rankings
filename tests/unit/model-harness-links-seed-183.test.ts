/**
 * #183 B-2 step 2: the committed model <-> harness seed plans with no refusals.
 *
 * Why: `docs/refresh/model-harness-links.csv` is the reviewed seed the loader will apply
 *   (after an Architect GO). Every row must pass the writer's rules against the kinds the
 *   reviewed sheet sets, before anyone points the loader at a real database.
 * What: builds PGlite from the on-disk migrations 0000..0016 seeded with the audit's tools,
 *   applies the committed 0017 backfill (the kinds from `docs/refresh/tool-kind-mapping.csv`)
 *   through the runner, then runs `loadToolLinks` in dry-run mode on the parsed seed.
 *   Asserts 17 rows, 0 refused, every row an insert, nothing written, and that no seed
 *   slug is a retired duplicate in the sheet.
 * Test: `npx vitest run tests/unit/model-harness-links-seed-183.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseKindSheet } from "../../lib/db/tool-kind-sheet";
import { runMigrations } from "../../scripts/apply-migrations";
import { loadToolLinks, parseSeed } from "../../scripts/load-tool-links";
import { chainDb, MIGRATION_FILES, readMigration, REPO_ROOT } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

const SEED_FILE = path.join(REPO_ROOT, "docs/refresh/model-harness-links.csv");
const BACKFILL = "0017_backfill_tool_kind.sql";

describe("#183 docs/refresh/model-harness-links.csv", () => {
  let db: PGlite;
  let log: string[];
  let exitCode: number;
  const rows = parseSeed(SEED_FILE, readFileSync(SEED_FILE, "utf8"));

  beforeAll(async () => {
    db = await chainDb(BACKFILL);
    const backfill = await runMigrations(
      { db: pgliteMigrationDb(db), files: { list: () => [...MIGRATION_FILES], read: readMigration }, log: () => {} },
      { dryRun: false, only: BACKFILL, showColumns: null, force: false }
    );
    expect(backfill.exitCode).toBe(0);
    log = [];
    exitCode = await loadToolLinks(drizzle(db), rows, false, (line) => log.push(line));
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it("parses as 17 links with the loader's header and relations", () => {
    expect(rows).toHaveLength(17);
    for (const row of rows) expect(["native", "supports"]).toContain(row.relation);
  });

  it("plans every row as an insert with 0 refusals, and the dry run writes nothing", async () => {
    expect(log.filter((line) => line.startsWith("REFUSED"))).toEqual([]);
    expect(log).toContain("17 row(s), 0 refused");
    expect(log.filter((line) => line.startsWith("would insert: "))).toHaveLength(17);
    expect(exitCode).toBe(0);
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public."tool_links"`)).rows[0]!.n).toBe(0);
  });

  it("names no retired duplicate from the sheet, and leaves out the three weakly sourced rows", () => {
    const sheet = parseKindSheet(readFileSync(path.join(REPO_ROOT, "docs/refresh/tool-kind-mapping.csv"), "utf8"));
    expect(sheet.errors).toEqual([]);
    const retired = new Set(sheet.rows.filter((r) => r.retired).map((r) => r.slug));
    for (const row of rows) expect([row.modelSlug, row.harnessSlug].filter((s) => retired.has(s))).toEqual([]);
    const pairs = rows.map((r) => `${r.modelSlug} -> ${r.harnessSlug}`);
    for (const dropped of ["opus-4-6 -> openclaw", "sonnet-4-5 -> goose", "deepseek -> aider"]) expect(pairs).not.toContain(dropped);
  });
});
