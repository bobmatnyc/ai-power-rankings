/**
 * L1: the logo lint passes a good fixture and fails each bad-manifest case.
 * Fixtures are temp dirs holding made-up bytes, never real vendor marks.
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { lintLogos } from "../../lib/logos/lint";
import { validateManifest } from "../../lib/logos/manifest";

const roots: string[] = [];
const BYTES = "fixture bytes, not a real mark";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function entry(over: Record<string, unknown> = {}) {
  return {
    vendor: "made-up-vendor",
    file: "public/logos/made-up-vendor.svg",
    source_url: "https://example.invalid/brand",
    terms_url: "https://example.invalid/terms",
    terms_note: "fixture",
    fetched_at: "2026-01-01",
    sha256: sha(BYTES),
    status: "permitted",
    ...over,
  };
}

/** Builds a fixture repo: a manifest, and the listed files under public/logos. */
function fixture(logos: unknown[], files: Record<string, string> = { "made-up-vendor.svg": BYTES }) {
  const root = mkdtempSync(path.join(tmpdir(), "logo-lint-"));
  roots.push(root);
  mkdirSync(path.join(root, "data/logos"), { recursive: true });
  mkdirSync(path.join(root, "public/logos"), { recursive: true });
  writeFileSync(path.join(root, "data/logos/manifest.json"), JSON.stringify({ version: 1, logos }));
  writeFileSync(path.join(root, "public/logos/README.md"), "not a mark");
  for (const [name, body] of Object.entries(files)) writeFileSync(path.join(root, "public/logos", name), body);
  return root;
}

afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("lintLogos", () => {
  it("passes a good fixture and an empty one", () => {
    expect(lintLogos(fixture([entry()]))).toEqual([]);
    expect(lintLogos(fixture([], {}))).toEqual([]);
  });

  it("fails a file with no manifest entry", () => {
    const errors = lintLogos(fixture([entry()], { "made-up-vendor.svg": BYTES, "stray.svg": "x" }));
    expect(errors.join("\n")).toMatch(/stray\.svg: no manifest entry/);
  });

  it("fails when an entry's file is missing", () => {
    expect(lintLogos(fixture([entry()], {})).join("\n")).toMatch(/is missing/);
  });

  it("fails when the sha256 mismatches", () => {
    const errors = lintLogos(fixture([entry({ sha256: sha("other bytes") })]));
    expect(errors.join("\n")).toMatch(/sha256 .* does not match/);
  });

  it.each(["source_url", "terms_url", "terms_note", "fetched_at", "vendor"])("fails when %s is empty", (field) => {
    expect(lintLogos(fixture([entry({ [field]: "" })])).length).toBeGreaterThan(0);
  });

  it("fails when a required provenance field is absent", () => {
    const { terms_note: _omit, ...rest } = entry();
    expect(lintLogos(fixture([rest])).join("\n")).toMatch(/terms_note/);
  });

  it("fails a monogram entry that ships a file, and passes one that ships none", () => {
    const shipped = lintLogos(fixture([entry({ status: "monogram" })]));
    expect(shipped.join("\n")).toMatch(/monogram entry must not ship a file/);
    const none = entry({ status: "monogram", file: null, sha256: null });
    expect(lintLogos(fixture([none], {}))).toEqual([]);
  });

  it("rejects a reference-only file under public/, and accepts one outside it", () => {
    const inPublic = entry({ status: "reference-only" });
    expect(lintLogos(fixture([inPublic])).join("\n")).toMatch(/reference-only file must be under data\/logos\/reference\//);
    const root = fixture([entry({ status: "reference-only", file: "data/logos/reference/made-up-vendor.svg" })], {});
    mkdirSync(path.join(root, "data/logos/reference"), { recursive: true });
    writeFileSync(path.join(root, "data/logos/reference/made-up-vendor.svg"), BYTES);
    expect(lintLogos(root)).toEqual([]);
  });

  // #303: a `..`, `./` or leading `/` passes a bare prefix check yet resolves outside the allowed dir.
  it.each([
    ["reference-only", "data/logos/reference/../../../public/brand/v.svg"],
    ["permitted", "public/logos/../tool-icons/v.svg"],
    ["permitted", "public/logos/./v.svg"],
    ["permitted", "/public/logos/v.svg"],
    ["permitted", "public/logos/%2e%2e/tool-icons/v.svg"],
    ["permitted", "public/logos/..\\tool-icons\\v.svg"],
  ])("rejects a non-normalised %s file path (%s)", (status, file) => {
    const logos = [entry({ status, file })];
    expect(validateManifest({ version: 1, logos }).join("\n")).toMatch(/not a normalised repo-relative path/);
    expect(lintLogos(fixture(logos, {})).join("\n")).toMatch(/not a normalised repo-relative path/);
  });

  it("fails when the manifest is missing or not JSON", () => {
    const root = fixture([]);
    writeFileSync(path.join(root, "data/logos/manifest.json"), "{ not json");
    expect(lintLogos(root).join("\n")).toMatch(/not valid JSON/);
    rmSync(path.join(root, "data/logos/manifest.json"));
    expect(lintLogos(root).join("\n")).toMatch(/missing/);
  });
});

describe("the shipped manifest", () => {
  it("lints clean and holds no permitted entry in L1", () => {
    const root = path.resolve(__dirname, "../..");
    expect(lintLogos(root)).toEqual([]);
    const manifest = JSON.parse(readFileSync(path.join(root, "data/logos/manifest.json"), "utf8"));
    expect(manifest.logos.filter((e: { status: string }) => e.status === "permitted")).toEqual([]);
  });
});
