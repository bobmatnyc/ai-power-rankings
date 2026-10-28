/**
 * #314: the productivity-board seed file and its validator.
 *
 * Why: the 9 new productivity rows come from a reviewed seed, never from a collector. A row with
 *   no vendor source, a colliding slug or a wrong kind must stop the run, so the parser throws.
 * What: parses the committed seed, then feeds one broken variant per rule to the parser. The
 *   taken-slug set is built from the kind sheet, the closed-model seed and the reserved segments.
 * Test: `npx vitest run tests/unit/productivity-seed-314.test.ts`. No server, no network, no database.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "../../i18n/config";
import { parseProductivitySeed } from "../../lib/db/repositories/productivity-seed.repository";
import { parseKindSheet } from "../../lib/db/tool-kind-sheet";
import { RESERVED_FIRST_SEGMENTS } from "../../lib/seo/url-table";

const ROOT = path.resolve(__dirname, "../..");
const SEED_TEXT = readFileSync(path.join(ROOT, "docs/refresh/productivity-tools.json"), "utf8");
const SHEET_SLUGS = parseKindSheet(readFileSync(path.join(ROOT, "docs/refresh/tool-kind-mapping.csv"), "utf8")).rows.map(
  (r) => r.slug
);
const CLOSED_SLUGS = (
  JSON.parse(readFileSync(path.join(ROOT, "docs/refresh/closed-models.json"), "utf8")) as { models: { slug: string }[] }
).models.map((m) => m.slug);
const TAKEN = new Set([...SHEET_SLUGS, ...CLOSED_SLUGS]);
const RESERVED = new Set<string>([...RESERVED_FIRST_SEGMENTS, ...locales]);

type Doc = { checked_at: string; products: Record<string, unknown>[] } & Record<string, unknown>;

function parseWith(edit: (doc: Doc) => void, taken: ReadonlySet<string> = TAKEN) {
  const doc = JSON.parse(SEED_TEXT) as Doc;
  edit(doc);
  return parseProductivitySeed(JSON.stringify(doc), { takenSlugs: taken, reservedSegments: RESERVED });
}

describe("#314 committed seed file", () => {
  const seed = parseProductivitySeed(SEED_TEXT, { takenSlugs: TAKEN, reservedSegments: RESERVED });

  it("parses and holds exactly the 9 new productivity slugs", () => {
    expect(seed.products.map((p) => p.slug).sort()).toEqual(
      [
        "chatgpt",
        "genspark",
        "gemini-app",
        "grok-app",
        "hermes-agent",
        "manus",
        "microsoft-copilot",
        "mistral-vibe",
        "notion-ai",
      ].sort()
    );
  });

  it("gives every row an https vendor source URL, kind productivity and status inactive", () => {
    for (const p of seed.products) {
      expect(p.sourceUrl, p.slug).toMatch(/^https:\/\//);
      expect(p.kind, p.slug).toBe("productivity");
      expect(p.status, p.slug).toBe("inactive");
    }
  });

  it("does not seed the six existing rows that 0028 converts", () => {
    const slugs = seed.products.map((p) => p.slug);
    for (const s of ["claude-artifacts", "openclaw", "perplexity", "chatgpt-canvas", "cowork", "claude-desktop-extensions"]) {
      expect(slugs).not.toContain(s);
    }
  });

  it("carries no score, metric, rank, secret-shaped or host-shaped text", () => {
    expect(SEED_TEXT).not.toMatch(/"(score|rank|metrics?|users|arr)"|postgres(ql)?:\/\/|ghp_|sk-[A-Za-z0-9]{10}|neon\.tech/i);
  });
});

describe("#314 parseProductivitySeed throws", () => {
  const first = (doc: Doc) => doc.products[0]!;

  it.each([
    ["a missing source_url", (d: Doc) => delete first(d)["source_url"]],
    ["an empty source_url", (d: Doc) => (first(d)["source_url"] = " ")],
    ["a non-https source_url", (d: Doc) => (first(d)["source_url"] = "http://example.test/a")],
    ["a kind other than productivity", (d: Doc) => (first(d)["kind"] = "harness")],
    ["a missing kind", (d: Doc) => delete first(d)["kind"]],
    ["an active status", (d: Doc) => (first(d)["status"] = "active")],
    ["a slug already in the kind sheet", (d: Doc) => (first(d)["slug"] = "claude-artifacts")],
    ["a slug already in the closed-model seed", (d: Doc) => (first(d)["slug"] = "gpt-sol")],
    ["a reserved first segment", (d: Doc) => (first(d)["slug"] = "api")],
    ["a locale-code slug", (d: Doc) => (first(d)["slug"] = "de")],
    ["a duplicate slug", (d: Doc) => (d.products[1]!["slug"] = first(d)["slug"])],
    ["an upper-case slug", (d: Doc) => (first(d)["slug"] = "ChatGPT")],
    ["a missing company", (d: Doc) => delete first(d)["company"]],
    ["a subcategory that breaks the database check", (d: Doc) => (first(d)["subcategory"] = "AI Assistant")],
    ["a category other than productivity", (d: Doc) => (first(d)["category"] = "other")],
    ["a non-https website_url", (d: Doc) => (first(d)["website_url"] = "chatgpt.com")],
    ["no products array", (d: Doc) => delete (d as Record<string, unknown>)["products"]],
    ["an empty products array", (d: Doc) => (d.products = [])],
    ["a missing checked_at", (d: Doc) => delete (d as Record<string, unknown>)["checked_at"]],
  ])("on %s", (_name, edit) => {
    expect(() => parseWith(edit)).toThrow();
  });

  it("on text that is not JSON", () => {
    expect(() => parseProductivitySeed("not json", { takenSlugs: TAKEN, reservedSegments: RESERVED })).toThrow();
  });

  it("names the rule in the message for a missing source", () => {
    expect(() => parseWith((d) => delete first(d)["source_url"])).toThrow(/source_url/);
  });

  it("accepts the seed when the taken set is empty (the collision rule is what rejected the slug)", () => {
    expect(() => parseWith((d) => (first(d)["slug"] = "claude-artifacts"), new Set())).not.toThrow();
  });
});
