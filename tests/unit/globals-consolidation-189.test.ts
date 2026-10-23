import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
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
 * requires `app/globals.css` to be the only `.css` file, loaded (static or
 * dynamic `import`, `require`, CSS `@import`, `/globals.css` URL) only by
 * `app/layout.tsx`; (2) counts hard-coded colours in `components/` and `app/`
 * exactly as docs/refresh/design-audit/one-off-styles.md "Method" describes,
 * less the #190 D2-D4 allowlist, and fails above the baseline or on an empty
 * scan; (3) caps the colour literals in each allowlisted file set that carries
 * a `literalCap`, so an exemption cannot grow unseen.
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

// #190: static and dynamic `import`, `require`, CSS `@import` (bare or `url(`),
// and the public `/globals.css` URL a <link> or fetch would use.
const GLOBALS_LOADER =
  /(?:\bimport\s*(?:[\w*{}\s,]+from\s*)?\(?\s*|\brequire\s*\(\s*|@import\s+(?:url\(\s*)?)["'][^"'\n]*globals\.css["']|["']\/globals\.css["']/;

// Every file type that can import a stylesheet.
const LOADER_SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mdx|css|scss|sass|less|pcss)$/;
// This file holds loader fixtures, so it is the one source the scan skips.
const SELF = "tests/unit/globals-consolidation-189.test.ts";

describe("single global stylesheet (#189)", () => {
  it("has app/globals.css as the only stylesheet in the repo", () => {
    expect(walk(root, (p) => p.endsWith(".css")).sort()).toEqual(["app/globals.css"]);
  });

  it("recognises every way a file can load globals.css", () => {
    for (const loader of [
      'import "./globals.css";',
      "import styles from '../app/globals.css'",
      'const css = await import("@/app/globals.css");',
      "import(\n  '../../app/globals.css'\n)",
      'require("./globals.css")',
      '@import "../app/globals.css";',
      "@import url('/app/globals.css') screen;",
      '<link rel="stylesheet" href="/globals.css" />',
    ]) {
      expect(GLOBALS_LOADER.test(loader), loader).toBe(true);
    }
    expect(GLOBALS_LOADER.test('readFileSync(join(root, "app", "globals.css"))')).toBe(false);
  });

  it("loads globals.css only through the app/layout.tsx import, anywhere in the repo", () => {
    // #190: the whole repo, not only app/, components/ and lib/.
    const sources = walk(root, (p) => LOADER_SOURCE.test(p)).filter((file) => file !== SELF);
    expect(sources.length, "files scanned for globals.css loaders").toBeGreaterThan(0);
    const readers = sources.filter((file) => GLOBALS_LOADER.test(readFileSync(join(root, file), "utf8")));
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

/**
 * Measured count after the allowlist below. #190 PR A: 791, the #188 audit's
 * 845 less 35 (open-graph routes), 8 (contact email) and 11 (globals.css
 * `--shadow*` values). #190 PR B: 708, after 83 core-component uses moved to
 * tokens. #190 PR C1: 707, the subscribe checkbox's `border-gray-300`. #190
 * C2: 679, the 28 gradient stops in tool-icon.tsx (18) and tier-legend.tsx
 * (10); lib/ranking-utils.ts is outside the scan. #190 PR D: 459, the 220
 * uses on the news, what's-new, SEO and best-* pages and their components.
 * Lower it as #190 migrates; never raise it.
 */
const HARDCODED_COLOUR_BASELINE = 459;

/**
 * #190 rulings D2-D4: the only places a literal colour is the right tool. An
 * entry exempts the whole file unless `scope` narrows it to `--shadow*`
 * custom-property declarations, so every other colour in that file counts.
 * `literalCap` is the measured count of colour literals in the files an
 * entry matches; lower it when they fall, never raise it.
 */
const RATCHET_ALLOWLIST: ReadonlyArray<{
  path: RegExp;
  scope?: "shadow-custom-properties";
  literalCap?: number;
  reason: string;
}> = [
  {
    // #190 option D: the OG exemption is permanent, so its literals are capped
    // instead of migrated. 36 includes the 9-digit `#059669010` in ranking/route.tsx.
    path: /^app\/api\/og\//,
    literalCap: 36,
    reason: "D2: open-graph images render through next/og (Satori), which cannot read CSS variables.",
  },
  {
    path: /^app\/api\/contact\/route\.ts$/,
    reason: "D3: the contact email's HTML is read by mail clients, which need literal colours.",
  },
  {
    path: /^app\/globals\.css$/,
    scope: "shadow-custom-properties",
    reason: "D4: the `--shadow*` definitions' rgb() values; any other colour in the file counts.",
  },
];

// #190: `--shadow*` only, so a new `--brand: #f00;` in globals.css still counts.
const SHADOW_PROPERTY_DECLARATION = /--shadow[\w-]*\s*:[^;{}]*;/g;

/** The files the ratchet scans under `dirs`: sources and CSS, tests excluded. */
function colourScanFiles(dirs: string[]): string[] {
  const files = dirs.flatMap((dir) => walk(dir, (p) => /\.(ts|tsx|css)$/.test(p) && !/\.(test|spec)\./.test(p)));
  // #190: an empty scan counts 0 and would pass any baseline, so it is an error.
  if (files.length === 0) throw new Error(`colour ratchet scanned no files under ${dirs.join(", ")}`);
  return files;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Hard-coded colour uses in one file's text, comments stripped first. */
function countHardcodedColours(source: string): number {
  const code = stripComments(source);
  return Object.values(COLOUR_PATTERNS).reduce((sum, re) => sum + (code.match(re)?.length ?? 0), 0);
}

// #190: literal colours only. Hex takes any run of 3+ digits so a malformed
// literal such as `#059669010` still counts once.
const COLOUR_LITERALS = [/#[0-9a-fA-F]{3,}(?![\w-])/g, /\brgba?\(/g, /\bhsla?\(/g];

/** Hex, rgb/rgba and hsl/hsla literals in one file's text, comments stripped first. */
function countColourLiterals(source: string): number {
  const code = stripComments(source);
  return COLOUR_LITERALS.reduce((sum, re) => sum + (code.match(re)?.length ?? 0), 0);
}

/** One scanned file's uses, split into those the ratchet counts and those the allowlist exempts. */
function ratchetCount(file: string, source: string): { counted: number; exempted: number } {
  const total = countHardcodedColours(source);
  const entry = RATCHET_ALLOWLIST.find(({ path }) => path.test(file));
  if (!entry) return { counted: total, exempted: 0 };
  if (!entry.scope) return { counted: 0, exempted: total };
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const counted = countHardcodedColours(code.replace(SHADOW_PROPERTY_DECLARATION, ""));
  return { counted, exempted: total - counted };
}

function scanRepoColours(): Array<{ file: string; counted: number; exempted: number }> {
  return colourScanFiles(["components", "app"].map((dir) => join(root, dir))).map((file) => ({
    file,
    ...ratchetCount(file, readFileSync(join(root, file), "utf8")),
  }));
}

describe("hard-coded colour ratchet (#189)", () => {
  it("counts each kind of hard-coded colour the audit counts", () => {
    expect(countHardcodedColours('className="text-green-600 dark:bg-red-900/20 hover:text-white"')).toBe(3);
    expect(countHardcodedColours('const c = "#fff"; const d = "rgba(0,0,0,.5)"; // #156 text-red-500')).toBe(2);
    expect(countHardcodedColours('className="bg-ds-surface text-primary text-green-600x"')).toBe(0);
  });

  it("fails when the scan finds no files", () => {
    const empty = mkdtempSync(join(tmpdir(), "ratchet-empty-"));
    try {
      expect(() => colourScanFiles([empty])).toThrow(/no files/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("exempts custom-property declarations only where the allowlist scopes it so", () => {
    const css = ":root { --shadow: 0 1px 2px rgb(0 0 0 / 0.1); }\n.x { color: #123456; }";
    expect(ratchetCount("app/globals.css", css)).toEqual({ counted: 1, exempted: 1 });
    expect(ratchetCount("app/other.css", css)).toEqual({ counted: 2, exempted: 0 });
    expect(ratchetCount("app/api/og/tool/route.tsx", 'color: "#fff"')).toEqual({ counted: 0, exempted: 1 });
  });

  it("exempts only --shadow* declarations in app/globals.css", () => {
    // #190: a non-shadow custom property holding a literal colour still counts.
    expect(ratchetCount("app/globals.css", ":root { --brand: #f00; }")).toEqual({ counted: 1, exempted: 0 });
    expect(ratchetCount("app/globals.css", ":root { --shadow-lg: 0 0 1px rgb(0 0 0); }")).toEqual({
      counted: 0,
      exempted: 1,
    });
  });

  it.each(RATCHET_ALLOWLIST.map((entry) => [entry.path.source, entry] as const))(
    "allowlist entry %s matches a scanned file and exempts at least one use",
    (_, entry) => {
      const hits = scanRepoColours().filter(({ file }) => entry.path.test(file));
      expect(hits.length, entry.reason).toBeGreaterThan(0);
      expect(hits.reduce((sum, h) => sum + h.exempted, 0), entry.reason).toBeGreaterThan(0);
    },
  );

  it("counts hex, rgb/rgba and hsl/hsla literals, including a malformed 9-digit hex", () => {
    expect(countColourLiterals('a: "#fff", b: "#1e40af20", c: "#059669010", d: "rgba(0,0,0,.1)"')).toBe(4);
    expect(countColourLiterals('e: "hsl(0 0% 0%)", f: "hsla(0,0%,0%,.5)" // "#abc"')).toBe(2);
  });

  // #190 option D: the OG routes stay exempt permanently, so their literal count may fall but not rise.
  it.each(
    RATCHET_ALLOWLIST.filter((entry) => entry.literalCap !== undefined).map(
      (entry) => [entry.path.source, entry] as const,
    ),
  )("allowlist entry %s stays at or below its literal cap", (_, entry) => {
    const files = colourScanFiles([join(root, "app"), join(root, "components")]).filter((file) => entry.path.test(file));
    expect(files.length, entry.reason).toBeGreaterThan(0);
    const total = files.reduce((sum, file) => sum + countColourLiterals(readFileSync(join(root, file), "utf8")), 0);
    expect(total, `colour literals in ${entry.path.source} (lower literalCap when this falls)`).toBeLessThanOrEqual(
      entry.literalCap ?? 0,
    );
  });

  it(`stays at or below the ${HARDCODED_COLOUR_BASELINE} baseline`, () => {
    const total = scanRepoColours().reduce((sum, { counted }) => sum + counted, 0);
    expect(total, "hard-coded colours in components/ and app/ (migrate to --ds-* tokens instead)").toBeLessThanOrEqual(
      HARDCODED_COLOUR_BASELINE,
    );
  });
});
