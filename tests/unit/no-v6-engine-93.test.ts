import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The live app does not use the V6 ranking engine (#93).
 *
 * Why: #93 retires `lib/ranking-algorithm-v6.ts`; the admin route was its only
 *   importer. A new importer would bring back a second scoring path that
 *   disagrees with the published rankings.
 * What: scans non-test source under `app/`, `components/` and `lib/services/`
 *   for the module path or the class name, and checks the file is gone.
 * Test: `npx vitest run tests/unit/no-v6-engine-93.test.ts`.
 */

const ROOT = join(__dirname, "..", "..");
const SCANNED = ["app", "components", join("lib", "services")];
const SOURCE = /\.(ts|tsx|js|jsx|mjs)$/;
const TEST = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const V6 = /ranking-algorithm-v6\b|RankingEngineV6/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return SOURCE.test(name) && !TEST.test(name) ? [path] : [];
  });
}

describe("V6 ranking engine is retired (#93)", () => {
  it("no live source file references it", () => {
    const hits = SCANNED.flatMap((dir) => sourceFiles(join(ROOT, dir)))
      .filter((file) => V6.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file));
    expect(hits).toEqual([]);
  });

  it("the engine file is deleted", () => {
    expect(existsSync(join(ROOT, "lib", "ranking-algorithm-v6.ts"))).toBe(false);
  });
});
