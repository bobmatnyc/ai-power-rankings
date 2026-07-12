import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Resolve the repo-relative path of the static rankings cache file.
 *
 * The real cache directory is `data/cache/` (there is no `src/data/` in the
 * repo). Writing to a nonexistent `src/data/cache/…` path previously threw
 * ENOENT and left this file silently stale (issue #83).
 */
export function getRankingsStaticCachePath(): string {
  return join(process.cwd(), "data", "cache", "rankings-static.json");
}

/**
 * Persist the static rankings cache, creating the parent directory if it is
 * missing so a missing parent can never ENOENT.
 *
 * @returns the absolute path that was written.
 */
export function writeRankingsStaticCache(data: unknown): string {
  const cachePath = getRankingsStaticCachePath();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data, null, 2));
  return cachePath;
}
