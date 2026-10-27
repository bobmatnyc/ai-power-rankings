/**
 * #329: the open-weight refresh seed and the model seed validator.
 *
 * Why: model rows come from reviewed seed files. A bad row must stop the run, so the parser
 *   throws on every rule instead of warning or skipping.
 * What: parses the committed refresh seed, then feeds one broken variant per rule to the parser.
 * Test: `npx vitest run tests/unit/model-seed-329.test.ts`. No server, no network, no database.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseModelSeed } from "../../lib/db/repositories/model-seed.repository";

const ROOT = path.resolve(__dirname, "../..");
const SEED_TEXT = readFileSync(path.join(ROOT, "docs/refresh/open-weight-models-refresh.json"), "utf8");

type Row = Record<string, unknown> & { facts: Record<string, Record<string, unknown>> };
type Doc = { checked_at: string; models: Row[] } & Record<string, unknown>;

function parseWith(edit: (doc: Doc) => void) {
  const doc = JSON.parse(SEED_TEXT) as Doc;
  edit(doc);
  return parseModelSeed(JSON.stringify(doc));
}

describe("#329 open-weight refresh seed", () => {
  const seed = parseModelSeed(SEED_TEXT);

  it("holds the refreshed family rows, each inactive, kind model, open-weight, with a flagship repo", () => {
    expect(seed.models.map((m) => m.slug)).toEqual(["deepseek", "glm", "kimi", "qwen", "minimax"]);
    for (const row of seed.models) {
      expect(row.kind, row.slug).toBe("model");
      expect(row.status, row.slug).toBe("inactive");
      expect(row.openWeight, row.slug).toBe(true);
      expect(row.facts.hf_repo?.sourceUrl, row.slug).toMatch(/^https:\/\/huggingface\.co\//);
    }
  });

  it("marks every custom or unstated licence for review", () => {
    const pending = seed.models.filter((m) => m.licenceReview === "pending").map((m) => m.slug);
    expect(pending).toEqual(["glm", "kimi", "qwen", "minimax"]);
  });

  it("carries no secret-shaped or host-shaped text", () => {
    expect(SEED_TEXT).not.toMatch(/postgres(ql)?:\/\/|ghp_|sk-[A-Za-z0-9]{10}|neon\.tech|BEGIN [A-Z ]*KEY/);
  });
});

describe("#329 parseModelSeed throws", () => {
  const first = (d: Doc) => d.models[0]!;

  it.each<[string, RegExp, (d: Doc) => unknown]>([
    ["a duplicate slug", /duplicate slug/, (d) => (d.models[1]!["slug"] = first(d)["slug"])],
    ["a missing kind", /kind must be/, (d) => delete first(d)["kind"]],
    ["a kind other than model", /kind must be/, (d) => (first(d)["kind"] = "harness")],
    ["an active row", /status must be/, (d) => (first(d)["status"] = "active")],
    ["a missing status", /status must be/, (d) => delete first(d)["status"]],
    ["a stated fact with no source_url", /stated fact licence needs/, (d) => delete first(d).facts["licence"]!["source_url"]],
    ["a stated fact with a non-https source_url", /stated fact hf_repo needs/, (d) => (first(d).facts["hf_repo"]!["source_url"] = "http://x.test")],
    ["a missing row source_url", /source_url is required/, (d) => delete first(d)["source_url"]],
    ["an image model (D52)", /D52/, (d) => (first(d)["modality"] = "image")],
    ["a video model (D52)", /D52/, (d) => (first(d)["modality"] = "Video")],
    ["a missing modality", /modality is required/, (d) => delete first(d)["modality"]],
    ["the muse-wonder slug", /Muse Wonder/, (d) => (first(d)["slug"] = "muse-wonder")],
    ["a Muse Wonder name", /Muse Wonder/, (d) => (first(d)["name"] = "Muse Wonder Full")],
    ["a metrics field", /unknown field metrics/, (d) => (first(d)["metrics"] = { terminal_bench: 1 })],
    ["a fact outside the allow-list", /not an allowed fact/, (d) => (first(d).facts["terminal_bench"] = { value: "1", source_url: "https://x.test" })],
    ["a promotional description", /neutral/, (d) => (first(d)["description"] = "Our most capable agentic coding model.")],
    ["no current_version", /current_version is required/, (d) => delete first(d).facts["current_version"]],
    ["an open-weight row with no hf_repo", /needs facts\.hf_repo/, (d) => delete first(d).facts["hf_repo"]],
    ["a licence_review that does not match the licence", /licence_review must be/, (d) => (d.models[1]!["licence_review"] = "not_required")],
    ["a release_date after checked_at", /after checked_at/, (d) => (d.models[2]!.facts["release_date"]!["value"] = "2026-10-28")],
    ["active parameters above the total", /exceeds/, (d) => (d.models[3]!.facts["active_parameters_b"]!["value"] = 9999)],
    ["an empty models array", /no models array/, (d) => (d.models = [])],
  ])("on %s", (_name, message, edit) => {
    expect(() => parseWith(edit)).toThrow(message);
  });

  it("on a closed row that names a Hugging Face repo", () => {
    expect(() =>
      parseWith((d) => {
        first(d)["open_weight"] = false;
        delete first(d)["licence_review"];
      })
    ).toThrow(/closed row has no hf_repo/);
  });
});
