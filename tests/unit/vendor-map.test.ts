/**
 * L1: the tool-to-vendor map validates, and logo resolution honours the manifest status.
 * Fixtures use made-up slugs and no vendor marks.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type LogoManifest, permittedLogoUrl } from "../../lib/logos/manifest";
import { vendorForTool, vendorMapSchema } from "../../lib/logos/vendor-map";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf8"));

describe("data/logos/tool-vendor.json", () => {
  const map = vendorMapSchema.parse(read("data/logos/tool-vendor.json"));

  it("has non-empty vendor names and kebab vendor slugs", () => {
    for (const [slug, entry] of Object.entries(map.tools)) {
      expect(entry.vendor_name.trim(), slug).not.toBe("");
      expect(entry.vendor, slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("names every tool slug once, and each slug is a live board row", () => {
    const slugs = Object.keys(map.tools);
    expect(new Set(slugs).size).toBe(slugs.length);
    // JSON.parse keeps the last of two equal keys, so count the raw text too.
    const rawKeys = [...readFileSync(path.join(root, "data/logos/tool-vendor.json"), "utf8").matchAll(/^ {4}"([^"]+)": \{/gm)];
    expect(rawKeys.length).toBe(slugs.length);
    const sheet = readFileSync(path.join(root, "docs/refresh/tool-kind-mapping.csv"), "utf8").trim().split("\n").slice(1);
    const live = new Set(
      sheet.map((l) => l.split(",")).filter((c) => (c[1] === "harness" || c[1] === "model") && c[4] === "false").map((c) => c[0]),
    );
    for (const slug of slugs) expect(live.has(slug), slug).toBe(true);
  });

  it("rejects an empty vendor name and a duplicate-shaped bad slug", () => {
    const bad = { version: 1, tools: { "made-up-tool": { vendor: "Not Kebab", vendor_name: " " } } };
    expect(vendorMapSchema.safeParse(bad).success).toBe(false);
  });

  it("looks a vendor up by tool slug and returns null when unrecorded", () => {
    const fixture = vendorMapSchema.parse({
      version: 1,
      tools: { "made-up-tool": { vendor: "made-up-vendor", vendor_name: "Made Up Vendor" } },
    });
    expect(vendorForTool("made-up-tool", fixture)?.vendor_name).toBe("Made Up Vendor");
    expect(vendorForTool("unlisted-tool", fixture)).toBeNull();
    expect(vendorForTool(undefined, fixture)).toBeNull();
  });
});

describe("permittedLogoUrl", () => {
  const entry = {
    vendor: "made-up-vendor",
    file: "public/logos/made-up-vendor.svg" as string | null,
    source_url: "https://example.invalid/brand",
    terms_url: "https://example.invalid/terms",
    terms_note: "fixture",
    fetched_at: "2026-01-01",
    sha256: "0".repeat(64) as string | null,
  };
  const manifest = (status: "permitted" | "reference-only" | "monogram"): LogoManifest => ({
    version: 1,
    logos: [{ ...entry, status }],
  });

  it("returns the public URL only for a permitted entry", () => {
    expect(permittedLogoUrl(manifest("permitted"), "made-up-vendor")).toBe("/logos/made-up-vendor.svg");
    expect(permittedLogoUrl(manifest("reference-only"), "made-up-vendor")).toBeNull();
    expect(permittedLogoUrl(manifest("monogram"), "made-up-vendor")).toBeNull();
    expect(permittedLogoUrl(manifest("permitted"), "other-vendor")).toBeNull();
  });
});
