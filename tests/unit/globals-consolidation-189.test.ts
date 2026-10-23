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
 * less the #190 D2-D4 and Df8 allowlist, and fails above the baseline or on
 * an empty scan; (3) caps the colour literals (`literalCap`) or every counted
 * use (`colourCap`) in each allowlisted file set that carries a cap, so an
 * exemption cannot grow unseen.
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
 * #190 PR E1: 390, the 69 uses in the public modals, contact form, error and
 * not-found pages, chart skeleton, crown icon and image placeholder that have
 * an exact token; the 59 without one stay (migration-190e1.md). #190 PR E2a:
 * 264, the 126 uses in the admin components and SEO dashboard that have an
 * exact token; the 55 without one stay (migration-190e2a.md). #190 ruling
 * Df8: 205, E1's 59 untokenised uses exempted per file below; then 150,
 * E2a's 55 untokenised uses exempted the same way. #190 PR E2b-1: 119, the
 * 31 auth uses: 15 moved to tokens, 14 exempted per file (Df8) and Clerk's
 * two colorPrimary values exempted permanently (migration-190e2b.md).
 * #190 PR E2b-2: 0, the 119 uses in the rest of app/[lang]/(authenticated)/:
 * 46 moved to tokens, 42 exempted per file (Df8) and clerk-debug/page.tsx's
 * 31 capped unchanged by architect ruling (migration-190e2b.md).
 * Lower it as #190 migrates; never raise it.
 */
// #190 E2b-2: lowered from 119 by the rest of app/[lang]/(authenticated)/.
const HARDCODED_COLOUR_BASELINE = 0;

/**
 * #190 rulings D2-D4 and Df8: the only places a literal colour is the right
 * tool, or where no token matches and the owner exempted it. An entry exempts
 * the whole file unless `scope` narrows it to `--shadow*` custom-property
 * declarations, so every other colour in that file counts. `literalCap` is
 * the measured count of colour literals in the files an entry matches;
 * `colourCap` is the measured count of every use the ratchet counts there
 * (palette classes, black/white, hex, rgb). Lower a cap when it falls, never
 * raise it.
 */
const RATCHET_ALLOWLIST: ReadonlyArray<{
  path: RegExp;
  scope?: "shadow-custom-properties";
  literalCap?: number;
  colourCap?: number;
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
  // #190 Df8 (owner, 2026-10-23): the 59 E1 colours with no exact token
  // (migration-190e1.md "Not migrated"), exempted per file and capped at the
  // measured count so the exemption cannot grow.
  {
    path: /^components\/ui\/whats-new-modal\.tsx$/,
    colourCap: 12,
    reason: "Df8: kind badges are bg-<hue>-100 text-<hue>-800 in both modes; the tag tokens switch to 900 at 30 % and 300 in dark.",
  },
  {
    path: /^components\/ui\/changelog-modal\.tsx$/,
    colourCap: 5,
    reason:
      "Df8: a light-only 100/800 badge, and text-blue-700 / text-red-700 in both modes; --ds-accent-hover and --ds-danger hold them in light only.",
  },
  {
    path: /^components\/ui\/signup-for-updates-modal\.tsx$/,
    colourCap: 2,
    reason: "Df8: text-blue-800 / dark:text-blue-400; --ds-text-tag-blue is blue-300 in dark.",
  },
  {
    path: /^components\/ui\/tech-stack-modal\.tsx$/,
    colourCap: 2,
    reason: "Df8: a bg-green-100 text-green-800 badge in both modes; the tag tokens switch in dark.",
  },
  {
    path: /^components\/contact\/contact-form\.tsx$/,
    colourCap: 18,
    reason:
      "Df8: no exact token for the sign-up card gradient stops, its blue-200/900 border and mail icon (HSL not exact), the alerts' 20 % dark tints and 800/200 text, or the gray-400/800 dots.",
  },
  {
    path: /^app\/error\.tsx$/,
    colourCap: 3,
    reason: "Df8: the card's box-shadow rgba values (no matching --shadow token) and the #111827 heading (only a surface token holds it).",
  },
  {
    path: /^app\/global-error\.tsx$/,
    colourCap: 9,
    reason: "Df8: renders its own <html> without the root layout, so app/globals.css and the --ds-* tokens may not load.",
  },
  {
    path: /^app\/not-found\.tsx$/,
    colourCap: 4,
    reason: "Df8: the card's box-shadow rgba values, and #111827 / #374151 headings that only surface and border tokens hold.",
  },
  {
    path: /^app\/\[lang\]\/not-found\.tsx$/,
    colourCap: 4,
    reason: "Df8: the card's box-shadow rgba values, and #111827 / #374151 headings that only surface and border tokens hold.",
  },
  // #190 Df8: the 55 E2a colours with no exact token (migration-190e2a.md
  // "Not migrated"), exempted per file and capped at the measured count.
  {
    path: /^components\/admin\/generation-stats\.tsx$/,
    colourCap: 24,
    reason:
      "Df8: the stat tiles' 50-step fills and 900-step values, the red-800/700 error and gray-700 to gray-900 text have no token in either mode.",
  },
  {
    path: /^components\/admin\/rankings-viewer\.tsx$/,
    colourCap: 14,
    reason:
      "Df8: 100/800 badges in both modes (the tag tokens switch in dark) and the top-3 rows' yellow-50/200/300, which no token holds.",
  },
  {
    path: /^components\/admin\/unified-admin-dashboard\.tsx$/,
    colourCap: 6,
    reason:
      "Df8: gray-700, blue-700, yellow-700 and green-800 text in both modes, and the db-status edge's inline #10b981 / #6b7280, which only a text token holds.",
  },
  {
    path: /^components\/admin\/news-ingestion-tool\.tsx$/,
    colourCap: 4,
    reason: "Df8: green-800 / red-800 alert text in both modes and the yellow-50/200 warning, which no token holds.",
  },
  {
    path: /^components\/admin\/admin-dashboard\.tsx$/,
    colourCap: 2,
    reason: "Df8: the disabled tiles' bg-gray-500; only a text token and a gradient stop hold #6b7280.",
  },
  {
    path: /^components\/admin\/character-counter\.tsx$/,
    colourCap: 2,
    reason: "Df8: text-orange-600 / dark:text-orange-400; --ds-accent-cat-orange-strong is orange-600 in both modes.",
  },
  {
    path: /^components\/admin\/article-management\.tsx$/,
    colourCap: 1,
    reason: "Df8: hover:text-red-700 in both modes; --ds-danger is red-700 in light only.",
  },
  {
    path: /^components\/admin\/tools-manager\.tsx$/,
    colourCap: 1,
    reason: "Df8: text-red-800 alert text in both modes, which no token holds.",
  },
  {
    path: /^components\/seo\/seo-dashboard\.tsx$/,
    colourCap: 1,
    reason: "Df8: text-red-700 in both modes; --ds-danger is red-700 in light only.",
  },
  // #190 E2b-1 (architect, 2026-10-23): permanent, the same class as D2.
  {
    path: /^(?:app\/\[lang\]\/\(authenticated\)\/layout\.tsx|components\/auth\/clerk-provider-client\.tsx)$/,
    literalCap: 2,
    colourCap: 2,
    reason:
      "Permanent (as D2): Clerk's appearance.variables.colorPrimary '#000000' is a value Clerk reads in JavaScript to build its own palette, so it cannot read a --ds-* token.",
  },
  // #190 Df8: the 14 E2b-1 auth colours with no exact token (migration-190e2b.md
  // "Not migrated"), exempted per file and capped at the measured count.
  {
    path: /^components\/auth\/no-auth-provider\.tsx$/,
    colourCap: 5,
    reason:
      "Df8: text-gray-700 (only a border token holds #374151) and the dev avatar's bg-gray-300 / hover:bg-gray-400 (only text tokens hold them).",
  },
  {
    path: /^components\/auth\/clerk-header\.tsx$/,
    colourCap: 3,
    reason:
      "Df8: Sign In's text-gray-700 and border-gray-300 (only a border and a text token hold them) and Sign Up's hover:bg-blue-700 (--ds-accent-hover is blue-700 in light only).",
  },
  {
    path: /^components\/auth\/auth-components-simple\.tsx$/,
    colourCap: 3,
    reason: "Df8: the dev helper's bg-yellow-100 / border-yellow-300 / text-yellow-800, which no token holds.",
  },
  {
    path: /^components\/auth\/clerk-direct-components\.tsx$/,
    colourCap: 2,
    reason:
      "Df8: hover:bg-gray-100 dark:hover:bg-gray-800; no token is gray-100 in light and gray-800 in dark, and a pair is never half migrated.",
  },
  {
    path: /^components\/auth\/user-button-with-admin\.tsx$/,
    colourCap: 1,
    reason: "Df8: the subscription item's onMouseEnter rgba(0, 0, 0, 0.03); no token holds that value.",
  },
  // #190 E2b-2 (architect, 2026-10-23): the developer page stays byte-for-byte, capped at its full count.
  {
    path: /^app\/\[lang\]\/\(authenticated\)\/clerk-debug\/page\.tsx$/,
    colourCap: 31,
    reason: "developer page; capped by Architect ruling 2026-10-23, parity only",
  },
  // #190 Df8: the 42 E2b-2 page colours with no exact token (migration-190e2b.md
  // "E2b-2", "Not migrated"), exempted per file and capped at the measured count.
  {
    path: /^app\/\[lang\]\/\(authenticated\)\/unauthorized\/page\.tsx$/,
    colourCap: 19,
    reason:
      "Df8: light/dark pairs no token holds in both modes (red-100 / red-900 at 20 %, gray-900 / white, gray-600 / gray-400, gray-500 / gray-500, gray-200 / gray-700, gray-300 / gray-600, gray-50 / gray-800) and hover:bg-blue-700 (--ds-accent-hover is blue-700 in light only).",
  },
  {
    path: /^app\/\[lang\]\/\(authenticated\)\/dashboard\/rankings\/\[period\]\/changes\/ranking-changes-summary\.tsx$/,
    colourCap: 6,
    reason: "Df8: green, red and blue 100/800 movement badges in both modes; the tag tokens switch to 900 and 300 in dark.",
  },
  {
    path: /^app\/\[lang\]\/\(authenticated\)\/dashboard\/auth\/error\/page\.tsx$/,
    colourCap: 5,
    reason:
      "Df8: bg-red-100, text-gray-900 and text-gray-800 (no text token holds them), hover:bg-blue-700 (--ds-accent-hover is light only) and hover:bg-gray-300 (only a text token holds it).",
  },
  {
    path: /^app\/\[lang\]\/\(authenticated\)\/dashboard\/tools\/\[slug\]\/dashboard-tool-detail\.tsx$/,
    colourCap: 4,
    reason: "Df8: green and red 100/800 position badges in both modes; the tag tokens switch to 900 and 300 in dark.",
  },
  {
    path: /^app\/\[lang\]\/\(authenticated\)\/admin\/whats-new-summary\/whats-new-summary-client\.tsx$/,
    colourCap: 4,
    reason:
      "Df8: text-green-800 (only a gradient token holds it), bg-blue-50 (--ds-accent-subtle is blue-900 in dark) and text-blue-800 (--ds-text-tag-blue is blue-300 in dark).",
  },
  {
    path: /^app\/\[lang\]\/\(authenticated\)\/admin\/automated-ingestion\/automated-ingestion-client\.tsx$/,
    colourCap: 2,
    reason:
      "Df8: the success alert's text-green-800 dark:text-green-200; --ds-text-callout-success-title is green-700 / green-300, and a pair is never half migrated.",
  },
  {
    path: /^app\/\[lang\]\/\(authenticated\)\/admin\/state-of-ai\/state-of-ai-client\.tsx$/,
    colourCap: 2,
    reason:
      "Df8: the success alert's text-green-800 dark:text-green-200; --ds-text-callout-success-title is green-700 / green-300, and a pair is never half migrated.",
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

  // #190 Df8: a whole-file exemption is capped on every counted use, so a new colour in the file fails.
  it.each(
    RATCHET_ALLOWLIST.filter((entry) => entry.colourCap !== undefined).map(
      (entry) => [entry.path.source, entry] as const,
    ),
  )("allowlist entry %s stays at or below its colour cap", (_, entry) => {
    const hits = scanRepoColours().filter(({ file }) => entry.path.test(file));
    expect(hits.length, entry.reason).toBeGreaterThan(0);
    const total = hits.reduce((sum, h) => sum + h.exempted, 0);
    expect(total, `colours in ${entry.path.source} (lower colourCap when this falls)`).toBeLessThanOrEqual(
      entry.colourCap ?? 0,
    );
  });

  it(`stays at or below the ${HARDCODED_COLOUR_BASELINE} baseline`, () => {
    const total = scanRepoColours().reduce((sum, { counted }) => sum + counted, 0);
    expect(total, "hard-coded colours in components/ and app/ (migrate to --ds-* tokens instead)").toBeLessThanOrEqual(
      HARDCODED_COLOUR_BASELINE,
    );
  });
});
