/**
 * #237 R6: the cron/timestamp deployment doc describes the migrated state.
 *
 * Why: after migration 0015 reached production, the doc still said every column is
 *   `timestamp without time zone` and called the migration "separate work". A reader
 *   would then treat a correct UTC value as zoneless, or drop the #103 shim that still
 *   protects unmigrated databases.
 * What: reads docs/deployment/cron-schedules-and-timestamps.md and checks that it
 *   (a) drops the pre-0015 claims, (b) names `timestamptz`, 0015 and its production
 *   apply, (c) keeps a paragraph saying the `naiveUtcTypes` shim is kept (R5),
 *   (d) names only `tests/unit/` paths that exist, and (e) carries no host,
 *   connection string or credential. No database.
 * Test: `npx vitest run tests/unit/timestamptz-237-doc.test.ts`.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const DOC = readFileSync(path.join(ROOT, "docs/deployment/cron-schedules-and-timestamps.md"), "utf8");
const PARAGRAPHS = DOC.split(/\n\s*\n/);

// #237: R6 — the doc must match production after 0015 (applied 2026-10-24).
describe("#237 cron-schedules-and-timestamps.md", () => {
  it("drops the pre-0015 claims", () => {
    expect(DOC).not.toMatch(/is `timestamp without time zone`/);
    expect(DOC).not.toMatch(/separate work/i);
  });

  it("names timestamptz, migration 0015 and its production apply", () => {
    expect(DOC).toContain("timestamptz");
    expect(DOC).toContain("`timestamp with time zone`");
    expect(DOC).toContain("0015_timestamptz_utc.sql");
    expect(DOC).toContain("2026-10-24");
    expect(DOC).toContain("40083541449");
    expect(DOC).toContain("73b3d716");
  });

  it("keeps a paragraph stating the #103 shim is kept (R5)", () => {
    const shim = PARAGRAPHS.filter(
      (p) => p.includes("naiveUtcTypes") && /\bkept\b/i.test(p) && p.includes("R5") && p.includes("#103")
    );
    expect(shim).toHaveLength(1);
    expect(shim[0]).toMatch(/unmigrated/i);
  });

  it("names only tests/unit paths that exist", () => {
    const named = [...new Set([...DOC.matchAll(/tests\/unit\/[\w./-]+\.test\.tsx?/g)].map((m) => m[0]))];
    expect(named).toContain("tests/unit/timestamptz-237-doc.test.ts");
    expect(named.filter((p) => !existsSync(path.join(ROOT, p)))).toEqual([]);
  });

  it("carries no host, connection string or credential (public repo)", () => {
    expect(DOC).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(DOC).not.toMatch(/neon\.tech|\bep-[a-z]+-[a-z]+-\w+|npg_\w+/i);
    expect(DOC).not.toMatch(/password|secret|neondb_owner/i);
  });
});
