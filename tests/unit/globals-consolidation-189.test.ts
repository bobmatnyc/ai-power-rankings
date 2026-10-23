import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression tests for #189 — one global stylesheet, and a ratchet on
 * hard-coded colours.
 *
 * Why: `public/globals.css` was a stale copy of `app/globals.css` that only a
 * dead component fetched; two stylesheets let token edits land in the wrong
 * one. The 845 hard-coded colours counted by the #188 audit migrate to tokens
 * in #190, so the count may fall but must not rise in the meantime.
 * What: (1) walks the repo (skipping dot-directories and build/output dirs) and
 * requires `app/globals.css` to be the only `.css` file, imported only by
 * `app/layout.tsx`; (2) counts hard-coded colours in `components/` and `app/`
 * exactly as docs/refresh/design-audit/one-off-styles.md "Method" describes and
 * fails above the 845 baseline.
 * Test: `npx vitest run tests/unit/globals-consolidation-189.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const SKIP_DIRS = new Set(["node_modules", "tmp", "test-results", "playwright-report", "coverage", "out"]);

function walk(dir: string, keep: (path: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, keep, out);
    else if (keep(path)) out.push(relative(root, path).split(sep).join("/"));
  }
  return out;
}

describe("single global stylesheet (#189)", () => {
  it("has app/globals.css as the only stylesheet in the repo", () => {
    expect(walk(root, (p) => p.endsWith(".css")).sort()).toEqual(["app/globals.css"]);
  });

  it("loads globals.css only through the app/layout.tsx import", () => {
    const loaders = /(?:import\s+["'][^"']*globals\.css["']|["']\/globals\.css["'])/;
    const sources = ["app", "components", "lib"].flatMap((dir) =>
      walk(join(root, dir), (p) => /\.(ts|tsx|js|jsx|mjs)$/.test(p)),
    );
    const readers = sources.filter((file) => loaders.test(readFileSync(join(root, file), "utf8")));
    expect(readers).toEqual(["app/layout.tsx"]);
  });
});

// The #188 audit's patterns (one-off-styles.md "Method"); variant prefixes such
// as `dark:` or `hover:` count with their class.
const HUES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR_PATTERNS: Record<string, RegExp> = {
  palette: new RegExp(
    `(?<![\\w-])(?:text|bg|border|from|via|to|ring|fill|stroke|divide|outline|placeholder|shadow|decoration|accent|caret)-(?:${HUES})-(?:50|[1-9]00|950)(?![\\w-])`,
    "g",
  ),
  blackWhite: /(?<![\w-])(?:text|bg|border|from|via|to)-(?:white|black)(?![\w-])/g,
  hex: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
  rgb: /\brgba?\(/g,
};

/** #188 audit total at f9db0a0f (845 in 85 files). Lower it as #190 migrates; never raise it. */
const HARDCODED_COLOUR_BASELINE = 845;

/** Hard-coded colour uses in one file's text, comments stripped first. */
function countHardcodedColours(source: string): number {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return Object.values(COLOUR_PATTERNS).reduce((sum, re) => sum + (code.match(re)?.length ?? 0), 0);
}

describe("hard-coded colour ratchet (#189)", () => {
  it("counts each kind of hard-coded colour the audit counts", () => {
    expect(countHardcodedColours('className="text-green-600 dark:bg-red-900/20 hover:text-white"')).toBe(3);
    expect(countHardcodedColours('const c = "#fff"; const d = "rgba(0,0,0,.5)"; // #156 text-red-500')).toBe(2);
    expect(countHardcodedColours('className="bg-ds-surface text-primary text-green-600x"')).toBe(0);
  });

  it(`stays at or below the ${HARDCODED_COLOUR_BASELINE} baseline`, () => {
    const files = ["components", "app"].flatMap((dir) =>
      walk(join(root, dir), (p) => /\.(ts|tsx|css)$/.test(p) && !/\.(test|spec)\./.test(p)),
    );
    const total = files.reduce((sum, f) => sum + countHardcodedColours(readFileSync(join(root, f), "utf8")), 0);
    expect(total, "hard-coded colours in components/ and app/ (migrate to --ds-* tokens instead)").toBeLessThanOrEqual(
      HARDCODED_COLOUR_BASELINE,
    );
  });
});
