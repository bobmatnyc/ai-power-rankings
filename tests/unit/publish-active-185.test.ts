import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #185 PR-3: the publish path writes per-list boards under the active profile set.
 *
 * Why: after activation the monthly cron and the CLI publish one board per list,
 *   each scored by its kind's v8 profile, and never write the combined board (its
 *   rows are kept). A refused or invalid profile set, or a failed write, must leave
 *   every row as it was and must not fall back to the combined layout or v7.10.
 * What: runs `publishActiveRankings()` and the cron route against the in-memory
 *   Drizzle stand-in, seeded with a current combined v7.10 row and tools of every kind.
 *   With a v8.0-active config (`tests/fixtures/scoring-profiles-v8-active-185.ts`) it
 *   checks the rows written, the version, per-kind weights, the tie order and that
 *   no write touches the combined rows. With a v7.10-active config and with a set
 *   missing a list profile it checks the refusal writes nothing; a failed
 *   insert rolls the whole publish back. #185 M3: a committed publish revalidates the
 *   `rankings` tag and the home, rankings and tools layouts and clears the in-memory
 *   rankings entries; a refused or failed publish revalidates nothing. #185: the checked-in active set is v8.0 with no `other` profile, and no
 *   publish writes an `other` board.
 * Test: `npx vitest run tests/unit/publish-active-185.test.ts`. No network.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));

// #185 M3: record the Next.js revalidation calls a publish makes.
const revalidation = vi.hoisted(() => ({ tags: [] as string[], paths: [] as string[] }));
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => revalidation.tags.push(tag),
  revalidatePath: (path: string, type?: string) => revalidation.paths.push(`${path}|${type ?? ""}`),
  unstable_cache: <T,>(fn: T) => fn,
}));

// The cron route loads the checked-in config; a test may hand it another one.
const profiles = vi.hoisted(() => ({ override: null as unknown }));
vi.mock("../../lib/scoring-profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/scoring-profiles")>();
  return {
    ...actual,
    loadCheckedInScoringProfiles: () => (profiles.override ?? actual.loadCheckedInScoringProfiles()) as never,
  };
});

import { GET as cronGET } from "../../app/api/cron/regenerate-rankings/route";
import { publishActiveRankings, resolvePublishScoring } from "../../lib/rankings/publish-active";
import { loadCheckedInScoringProfiles, profileWeights, ScoringProfileError } from "../../lib/scoring-profiles";
import { createFakeRankingsDb, type FakeToolRow, rankingRow } from "../../lib/services/__fixtures__/fake-rankings-db";
import { computeRankings } from "../../lib/services/ranking-generation.service";
import { legacyActiveConfig, v8ActiveConfig, v8ActiveRaw } from "../fixtures/scoring-profiles-v8-active-185";
import { RANKING_LISTS } from "../../lib/rankings/lists";
import { parseScoringProfiles } from "../../lib/scoring-profiles";
import cacheInstance from "../../lib/memory-cache";

const stamp = new Date("2026-01-01T00:00:00Z");
const now = () => new Date("2026-11-01T09:00:00.000Z");

function tool(id: string, kind: string, users: number, extra: Record<string, unknown> = {}): FakeToolRow {
  return {
    id,
    name: `Tool ${id}`,
    slug: `${id}-slug`,
    category: "other",
    status: "active",
    kind,
    data: { info: { description: id }, metrics: { users, github_stars: users / 10 }, ...extra },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

// h-tie-a and h-tie-b carry the same data, so they score the same under any profile.
const TOOLS: FakeToolRow[] = [
  ...Array.from({ length: 4 }, (_, i) => tool(`h${i + 1}`, "harness", 9_000_000 - i * 400_000)),
  tool("h-tie-a", "harness", 1_000_000),
  tool("h-tie-b", "harness", 1_000_000),
  ...Array.from({ length: 3 }, (_, i) => tool(`m${i + 1}`, "model", 8_800_000 - i * 400_000)),
  tool("p1", "productivity", 5_000_000),
  tool("o1", "other", 9_900_000),
];

// The published v7.10 board: h-tie-b sits above h-tie-a, so the tie order puts it first in the tie.
const COMBINED_DATA = ["h1", "h2", "h3", "h4", "h-tie-b", "h-tie-a", "m1", "m2", "m3", "p1", "o1"].map((id, i) => ({
  tool_id: id,
  rank: i + 1,
}));

let fake: ReturnType<typeof createFakeRankingsDb>;
beforeEach(() => {
  fake = createFakeRankingsDb({
    tools: TOOLS,
    rankings: [
      rankingRow({ period: "2026-10", isCurrent: true, algorithmVersion: "7.10", data: COMBINED_DATA, id: "combined-2026-10" }),
    ],
  });
  db.client = fake.client;
  profiles.override = null;
  revalidation.tags = [];
  revalidation.paths = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const rowOf = (list: string, period = "2026-11") =>
  fake.state.rankings.find((r) => (r.list ?? "combined") === list && r.period === period);
type Entry = { tool_id: string; rank: number; score: number };
const entries = (list: string) => rowOf(list)!.data as Entry[];

describe("resolvePublishScoring (#185)", () => {
  it("refuses a config whose active set is the legacy v7.10 table", () => {
    expect(() => resolvePublishScoring(legacyActiveConfig())).toThrow(/legacy one-table set/);
  });

  it("resolves the checked-in config to the v8.0 routing and stored version 8.0", () => {
    const scoring = resolvePublishScoring(loadCheckedInScoringProfiles());
    expect(scoring.setId).toBe("v8.0");
    expect(scoring.algorithmVersion).toBe("8.0");
  });

  it("refuses a per-kind set with no profile for a list", () => {
    const raw = v8ActiveRaw();
    delete raw["profileSets"]["v8.0"]["profiles"]["model"];
    expect(() => resolvePublishScoring(parseScoringProfiles(raw))).toThrow(/no profile for list\(s\): model/);
  });

  it("resolves a v8.0-active config to the v8.0 routing and stored version 8.0", () => {
    const scoring = resolvePublishScoring(v8ActiveConfig());
    expect(scoring.setId).toBe("v8.0");
    expect(scoring.algorithmVersion).toBe("8.0");
    expect(scoring.routing.route("model").weights).toEqual(profileWeights(v8ActiveConfig(), "v8.0", "model"));
  });
});

describe("publishActiveRankings with v8.0 active (#185)", () => {
  const publish = () => publishActiveRankings({ now, loadProfiles: v8ActiveConfig });

  it("writes one current 8.0 row per list and never writes or changes a combined row", async () => {
    const before = structuredClone(rowOf("combined", "2026-10"));
    const result = await publish();

    expect(result.layout).toBe("per-list");
    expect(result.algorithmVersion).toBe("8.0");
    expect(result.boards).toEqual([
      { list: "harness", toolCount: 6 },
      { list: "model", toolCount: 3 },
      { list: "productivity", toolCount: 1 },
    ]);
    for (const list of ["harness", "model", "productivity"]) {
      expect(rowOf(list)).toMatchObject({ isCurrent: true, algorithmVersion: "8.0" });
    }
    expect(rowOf("combined", "2026-10")).toEqual(before);
    expect(rowOf("combined")).toBeUndefined();
    for (const write of fake.state.writes) {
      expect(write.params ?? [], `${write.op} ${write.where}`).not.toContain("combined");
      if (write.op === "insert") expect((write.values as { list?: string }).list).toMatch(/^(harness|model|productivity)$/);
    }
  });

  it("scores each list with its kind's profile: model rows use the model weights, not v7.10", async () => {
    await publish();
    const config = v8ActiveConfig();
    const models = TOOLS.filter((t) => t.kind === "model");
    const withModel = computeRankings(models, new Map(), now(), profileWeights(config, "v8.0", "model"));
    const withV710 = computeRankings(models, new Map(), now());
    expect(entries("model").map((e) => e.score)).toEqual(withModel.map((e) => e.score));
    expect(entries("model").map((e) => e.score)).not.toEqual(withV710.map((e) => e.score));
  });

  it("a v8 tie follows the published v7.10 position, not the read order", async () => {
    await publish();
    const harness = entries("harness");
    const a = harness.find((e) => e.tool_id === "h-tie-a")!;
    const b = harness.find((e) => e.tool_id === "h-tie-b")!;
    expect(a.score).toBe(b.score);
    expect(b.rank).toBeLessThan(a.rank);
  });

  it("ranks no tool of kind other: it is in no list, so the set needs no other profile", async () => {
    await publish();
    const all = ["harness", "model", "productivity"].flatMap((list) => entries(list).map((e) => e.tool_id));
    expect(all).not.toContain("o1");
  });
});

describe("publish failure arms (#185, Fail-Open Check)", () => {
  it("a v7.10-active config is refused before any read or write", async () => {
    const loadActiveTools = vi.fn();
    const persistence = { loadActiveTools, loadCurrentRankings: vi.fn(), saveSnapshot: vi.fn(), saveListSnapshots: vi.fn() };
    await expect(publishActiveRankings({ now, persistence, loadProfiles: legacyActiveConfig })).rejects.toBeInstanceOf(
      ScoringProfileError
    );
    expect(loadActiveTools).not.toHaveBeenCalled();
    expect(persistence.saveSnapshot).not.toHaveBeenCalled();
    expect(persistence.saveListSnapshots).not.toHaveBeenCalled();
  });

  it("a failed list insert rolls back every list and never falls back to the combined board", async () => {
    const before = structuredClone(fake.state.rankings);
    const client = fake.client as { insert: (table: unknown) => { values: (v: Record<string, unknown>) => unknown } };
    const insert = client.insert;
    client.insert = (table) => ({
      values: (values) => {
        if (values["list"] === "model") throw new Error("fixture: insert failed");
        return insert(table).values(values);
      },
    });
    await expect(publishActiveRankings({ now, loadProfiles: v8ActiveConfig })).rejects.toThrow(/insert failed/);
    expect(fake.state.rankings).toEqual(before);
    expect(fake.state.writes).toEqual([]);
  });
});

describe("cache revalidation on publish (#185 M3)", () => {
  it("a committed publish revalidates the rankings tag and layouts and clears the in-memory route entries", async () => {
    cacheInstance.set("api:rankings:current:harness", { statusCode: 200, stale: true }, 60_000);
    cacheInstance.set("trending:harness:all", { stale: true }, 60_000);
    await publishActiveRankings({ now, loadProfiles: v8ActiveConfig });
    expect(revalidation.tags).toContain("rankings");
    expect(revalidation.paths).toEqual(expect.arrayContaining(["/|layout", "/rankings|layout", "/tools|layout"]));
    expect(cacheInstance.get("api:rankings:current:harness")).toBeNull();
    expect(cacheInstance.get("trending:harness:all")).toBeNull();
  });

  it("a refused publish revalidates nothing", async () => {
    await expect(publishActiveRankings({ now, loadProfiles: legacyActiveConfig })).rejects.toBeInstanceOf(
      ScoringProfileError
    );
    expect(revalidation.tags).toEqual([]);
    expect(revalidation.paths).toEqual([]);
  });

  it("a failed write revalidates nothing", async () => {
    const client = fake.client as { insert: (table: unknown) => { values: (v: Record<string, unknown>) => unknown } };
    client.insert = () => ({
      values: () => {
        throw new Error("fixture: insert failed");
      },
    });
    await expect(publishActiveRankings({ now, loadProfiles: v8ActiveConfig })).rejects.toThrow(/insert failed/);
    expect(revalidation.tags).toEqual([]);
  });

  it("the cron path revalidates after its publish", async () => {
    vi.stubEnv("CRON_SECRET", "s");
    profiles.override = v8ActiveConfig();
    const response = await cronGET(
      new Request("https://example.test/api/cron/regenerate-rankings", { headers: { authorization: "Bearer s" } })
    );
    expect(response.status).toBe(200);
    expect(revalidation.tags).toContain("rankings");
  });
});

describe("GET /api/cron/regenerate-rankings (#185)", () => {
  const cron = () =>
    cronGET(new Request("https://example.test/api/cron/regenerate-rankings", { headers: { authorization: "Bearer s" } }));
  beforeEach(() => vi.stubEnv("CRON_SECRET", "s"));

  it("publishes the per-list boards and reports each board", async () => {
    profiles.override = v8ActiveConfig();
    const response = await cron();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.algorithm_version).toBe("8.0");
    expect(body.boards.map((b: { list: string }) => b.list)).toEqual(["harness", "model", "productivity"]);
    // The cron publishes the current UTC month; find the row by list.
    const harness = fake.state.rankings.filter((r) => r.list === "harness");
    expect(harness.map((r) => [r.isCurrent, r.algorithmVersion])).toEqual([[true, "8.0"]]);
    expect(fake.state.rankings.find((r) => r.id === "combined-2026-10")?.isCurrent).toBe(true);
  });

  it("answers 500 and writes nothing while the active set is v7.10", async () => {
    profiles.override = legacyActiveConfig();
    const before = structuredClone(fake.state.rankings);
    const response = await cron();
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.details).toMatch(/legacy one-table set/);
    expect(fake.state.writes).toEqual([]);
    expect(fake.state.rankings).toEqual(before);
  });
});

describe("no other list under v8 (#185)", () => {
  it("the checked-in active set has no other profile, the cron publishes no other board, and other cannot re-enter", async () => {
    // The checked-in config itself, with no override: what the cron and the CLI publish.
    const config = loadCheckedInScoringProfiles();
    const active = config.profileSets[config.activeProfileSet]!;
    expect(config.activeProfileSet).toBe("v8.0");
    expect(Object.keys(active.profiles).sort()).toEqual(["harness", "model", "productivity"]);
    expect([...RANKING_LISTS]).not.toContain("other");
    expect(() => resolvePublishScoring(config).routing.route("other")).toThrow(/no profile for kind "other"/);

    vi.stubEnv("CRON_SECRET", "s");
    const response = await cronGET(
      new Request("https://example.test/api/cron/regenerate-rankings", { headers: { authorization: "Bearer s" } })
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.boards.map((b: { list: string }) => b.list)).toEqual(["harness", "model", "productivity"]);
    expect(fake.state.rankings.filter((r) => r.list === "other")).toEqual([]);
    const ranked = fake.state.rankings
      .filter((r) => r.list !== null && r.list !== undefined && r.list !== "combined")
      .flatMap((r) => (r.data as Entry[]).map((e) => e.tool_id));
    expect(ranked).not.toContain("o1");

    // The provisional other profile re-entering the active set is refused (S5).
    const reentered = v8ActiveRaw();
    reentered["profileSets"]["v8.0"]["profiles"]["other"] = {
      ...reentered["profileSets"]["v8.0"]["profiles"]["harness"],
      provisional: "harness weights, awaiting a decision on the other profile",
    };
    expect(() => parseScoringProfiles(reentered)).toThrow(/holds the provisional profile "other"/);
    // Without the provisional marker it parses, but the publish refuses a profile with no list.
    delete reentered["profileSets"]["v8.0"]["profiles"]["other"]["provisional"];
    expect(() => resolvePublishScoring(parseScoringProfiles(reentered))).toThrow(/profile\(s\) for no list: other/);
  });
});
