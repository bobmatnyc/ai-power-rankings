import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRankingsStaticCachePath, writeRankingsStaticCache } from "./rankings-static-cache";

describe("rankings-static-cache", () => {
  const originalCwd = process.cwd();
  let tmp: string;

  beforeEach(() => {
    // realpathSync resolves the macOS /var -> /private/var symlink so paths
    // match what process.cwd() reports after chdir.
    tmp = realpathSync(mkdtempSync(join(tmpdir(), "rankings-cache-")));
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("resolves to the real data/cache path, never the nonexistent src/data path", () => {
    const p = getRankingsStaticCachePath();
    expect(p).toBe(join(process.cwd(), "data", "cache", "rankings-static.json"));
    expect(p.endsWith(join("data", "cache", "rankings-static.json"))).toBe(true);
    expect(p).not.toContain(join("src", "data"));
  });

  it("creates the parent directory when missing (no ENOENT) and writes valid JSON", () => {
    // The parent dir does not exist yet in the fresh temp cwd.
    expect(existsSync(join(tmp, "data", "cache"))).toBe(false);

    const payload = { rankings: [{ rank: 1 }], is_current: true };
    const written = writeRankingsStaticCache(payload);

    expect(written).toBe(join(tmp, "data", "cache", "rankings-static.json"));
    expect(existsSync(written)).toBe(true);
    expect(JSON.parse(readFileSync(written, "utf-8"))).toEqual(payload);
  });
});
