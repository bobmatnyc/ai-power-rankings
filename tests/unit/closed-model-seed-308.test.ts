/**
 * #308: the closed-model seed file and its validator.
 *
 * Why: the seed is the reviewed source for the current closed models. A bad row must stop the
 *   run, so the parser throws on every rule instead of warning or skipping.
 * What: parses the committed seed, then feeds one broken variant per rule to the parser.
 *   A guard test checks that no ranking or scoring module reads the seed or the parser.
 * Test: `npx vitest run tests/unit/closed-model-seed-308.test.ts`. No server, no network, no database.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseClosedModelSeed } from "../../lib/db/repositories/closed-model-seed.repository";

const ROOT = path.resolve(__dirname, "../..");
const SEED_PATH = "docs/refresh/closed-models.json";
const SEED_TEXT = readFileSync(path.join(ROOT, SEED_PATH), "utf8");

type Doc = { checked_at: string; models: Record<string, unknown>[] } & Record<string, unknown>;

/** Parses the seed text after `edit` has changed a fresh copy of the document. */
function parseWith(edit: (doc: Doc) => void) {
  const doc = JSON.parse(SEED_TEXT) as Doc;
  edit(doc);
  return parseClosedModelSeed(JSON.stringify(doc));
}

describe("#308 committed seed file", () => {
  const seed = parseClosedModelSeed(SEED_TEXT);

  it("parses and holds exactly the 8 expected slugs", () => {
    expect(seed.models.map((m) => m.slug).sort()).toEqual(
      [
        "claude-fable",
        "claude-haiku",
        "gemini-argon",
        "gemini-flash",
        "gpt-astra",
        "gpt-luna",
        "gpt-sol",
        "gpt-terra",
      ].sort()
    );
    expect(seed.checkedAt).toBe("2026-10-26");
  });

  it("states kind, status, open_weight and null prices explicitly on every row", () => {
    for (const row of seed.models) {
      expect(row.kind, row.slug).toBe("model");
      expect(row.status, row.slug).toBe("inactive");
      expect(row.openWeight, row.slug).toBe(false);
      expect(row.priceInPerMtok, row.slug).toBeNull();
      expect(row.priceOutPerMtok, row.slug).toBeNull();
      expect(row.company, row.slug).not.toBe("");
      expect(row.apiModelId, row.slug).not.toBe("");
      expect(row.proof, row.slug).not.toBe("");
    }
  });

  it("dates claude-fable from the Claude Platform release notes", () => {
    const fable = seed.models.find((m) => m.slug === "claude-fable")!;
    expect(fable.releaseDate).toBe("2026-09-01");
    expect(fable.sourceUrl).toBe("https://platform.claude.com/docs/en/release-notes/overview");
    expect(fable.proof).toContain("September 1, 2026");
  });

  it("carries no secret-shaped or host-shaped text", () => {
    expect(SEED_TEXT).not.toMatch(/postgres(ql)?:\/\/|ghp_|sk-[A-Za-z0-9]{10}|neon\.tech|BEGIN [A-Z ]*KEY/);
  });
});

describe("#308 parseClosedModelSeed throws", () => {
  const first = (doc: Doc) => doc.models[0]!;

  it.each([
    ["a missing source_url", (d: Doc) => delete first(d)["source_url"]],
    ["a non-https source_url", (d: Doc) => (first(d)["source_url"] = "http://example.test/a")],
    ["a missing release_date", (d: Doc) => delete first(d)["release_date"]],
    ["a malformed release_date", (d: Doc) => (first(d)["release_date"] = "2026/10/07")],
    ["a non-calendar release_date", (d: Doc) => (first(d)["release_date"] = "2026-02-30")],
    ["a release_date after checked_at", (d: Doc) => (first(d)["release_date"] = "2026-10-27")],
    ["a kind other than model", (d: Doc) => (first(d)["kind"] = "harness")],
    ["a missing kind", (d: Doc) => delete first(d)["kind"]],
    ["an active status", (d: Doc) => (first(d)["status"] = "active")],
    ["a missing status", (d: Doc) => delete first(d)["status"]],
    ["a missing company", (d: Doc) => delete first(d)["company"]],
    ["an empty company", (d: Doc) => (first(d)["company"] = " ")],
    ["open_weight true", (d: Doc) => (first(d)["open_weight"] = true)],
    ["a missing open_weight", (d: Doc) => delete first(d)["open_weight"]],
    ["a duplicate slug", (d: Doc) => (d.models[1]!["slug"] = first(d)["slug"])],
    ["an upper-case slug", (d: Doc) => (first(d)["slug"] = "Claude-Haiku")],
    ["a slug with a leading hyphen", (d: Doc) => (first(d)["slug"] = "-claude")],
    ["a lite slug", (d: Doc) => (first(d)["slug"] = "gemini-flash-lite")],
    ["a nano name", (d: Doc) => (first(d)["name"] = "GPT Nano 1")],
    ["a mythos name", (d: Doc) => (first(d)["name"] = "Claude Mythos 5.1")],
    ["a mythos slug", (d: Doc) => (first(d)["slug"] = "claude-mythos")],
    // #329: Muse Wonder stays out until the owner rules on its source.
    ["the muse-wonder slug", (d: Doc) => (first(d)["slug"] = "muse-wonder")],
    ["a Muse Wonder name", (d: Doc) => (first(d)["name"] = "Muse Wonder Full")],
    ["a missing api_model_id", (d: Doc) => delete first(d)["api_model_id"]],
    ["a missing proof note", (d: Doc) => delete first(d)["proof"]],
    ["a negative price", (d: Doc) => (first(d)["price_in_per_mtok"] = -1)],
    ["a non-numeric price", (d: Doc) => (first(d)["price_out_per_mtok"] = "free")],
    ["no models array", (d: Doc) => delete (d as Record<string, unknown>)["models"]],
    ["an empty models array", (d: Doc) => (d.models = [])],
    ["a missing checked_at", (d: Doc) => delete (d as Record<string, unknown>)["checked_at"]],
  ])("on %s", (_name, edit) => {
    expect(() => parseWith(edit)).toThrow();
  });

  it("on text that is not JSON", () => {
    expect(() => parseClosedModelSeed("not json")).toThrow();
  });

  it("accepts a release_date equal to checked_at", () => {
    expect(() => parseWith((d) => (first(d)["release_date"] = d.checked_at))).not.toThrow();
  });
});

describe("#308 no-scoring guard", () => {
  /** Every .ts/.tsx file under `dir` (relative to ROOT), recursively. */
  function filesUnder(dir: string): string[] {
    const abs = path.join(ROOT, dir);
    return readdirSync(abs).flatMap((name) => {
      const rel = path.join(dir, name);
      return statSync(path.join(ROOT, rel)).isDirectory() ? filesUnder(rel) : /\.tsx?$/.test(name) ? [rel] : [];
    });
  }

  it("no ranking or scoring module imports the closed-model seed or parser", () => {
    const files = [
      ...readdirSync(path.join(ROOT, "lib"))
        .filter((n) => /^ranking-algorithm.*\.ts$/.test(n))
        .map((n) => path.join("lib", n)),
      ...filesUnder("lib/rankings"),
      "lib/services/ranking-generation.service.ts",
      "lib/scoring-profiles.ts",
      "lib/scoring-kind-routing.ts",
    ];
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      expect(readFileSync(path.join(ROOT, file), "utf8"), file).not.toMatch(
        /closed-model-seed|closed-models\.json|parseClosedModelSeed/
      );
    }
  });
});
