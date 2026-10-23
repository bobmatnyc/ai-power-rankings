import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * #231 — `/api/changelog` serves platform entries without CHANGELOG.md on disk.
 *
 * Why: The deploy dropped CHANGELOG.md (`.vercelignore` matched `/*.md`), so
 * the route answered `200 []` in production and the feed had no platform items.
 * What: Runs the route from a directory with no CHANGELOG.md and requires
 * entries plus `_sources` / `_degraded`. With an empty generated module the
 * route must answer 503 `no-store` with `_degraded: true`, never `200 []`.
 * Also pins the deploy config: `.vercelignore` keeps CHANGELOG.md and
 * `next.config.js` no longer needs `outputFileTracingIncludes`.
 * Test: `npx vitest run tests/unit/changelog-route-231.test.ts`.
 */

const root = join(__dirname, "..", "..");
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  vi.doUnmock("../../lib/data/changelog-entries");
  vi.resetModules();
});

describe("GET /api/changelog (#231)", () => {
  it("serves entries when CHANGELOG.md is not on disk", async () => {
    const empty = mkdtempSync(join(tmpdir(), "changelog-231-"));
    try {
      process.chdir(empty);
      const { GET } = await import("../../app/api/changelog/route");
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.items.some((item: { version: string }) => item.version === "Unreleased")).toBe(true);
      expect(data._degraded).toBe(false);
      expect(data._sources.changelog).toEqual({ status: "ok", count: data.items.length });
    } finally {
      process.chdir(originalCwd);
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("answers 503 no-store and _degraded when the generated module is empty", async () => {
    vi.doMock("../../lib/data/changelog-entries", () => ({ CHANGELOG_ENTRIES: [] }));
    const { GET } = await import("../../app/api/changelog/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(data._degraded).toBe(true);
    expect(data._sources.changelog.status).toBe("unavailable");
  });
});

describe("deploy config (#231)", () => {
  it(".vercelignore re-includes CHANGELOG.md and the generator after `/*.md`", () => {
    const lines = readFileSync(join(root, ".vercelignore"), "utf8").split("\n").map((l) => l.trim());
    expect(lines.indexOf("!/CHANGELOG.md")).toBeGreaterThan(lines.indexOf("/*.md"));
    expect(lines.indexOf("!scripts/generate-changelog-data.ts")).toBeGreaterThan(lines.indexOf("scripts/*"));
  });

  it("runtime code no longer reads CHANGELOG.md, so next.config.js drops outputFileTracingIncludes", () => {
    const config = readFileSync(join(root, "next.config.js"), "utf8");
    expect(config).not.toMatch(/outputFileTracingIncludes\s*:/);
    for (const file of [
      "app/api/changelog/route.ts",
      "app/api/whats-new/route.ts",
      "lib/services/whats-new-aggregation.service.ts",
    ]) {
      expect(readFileSync(join(root, file), "utf8"), file).not.toMatch(/readFile|CHANGELOG\.md"/);
    }
  });

  it("npm run build generates the changelog module before next build", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts.build).toMatch(/^npm run generate-changelog && .*next build$/);
  });
});
