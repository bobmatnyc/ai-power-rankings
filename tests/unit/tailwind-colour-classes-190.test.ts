import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { describe, expect, it } from "vitest";

/**
 * Every `text-*`, `bg-*` and `border-*` class in source resolves (#190 PR C1).
 *
 * Why: `text-destructive`, `bg-destructive` and `border-destructive` were used
 * in 8 places while tailwind.config.js had no `destructive` colour, so Tailwind
 * emitted nothing and destructive Alerts rendered uncoloured. Nothing failed.
 * What: collects each `text-`, `bg-` or `border-<name>` class (with an optional
 * `/<opacity>`) from the files Tailwind scans (app/, components/, lib/; unit
 * tests excluded),
 * compiles them with the repo config, and requires each one to produce a
 * utility. Tailwind's built-in palette and non-colour utilities (`text-sm`,
 * `border-2`) compile, so they pass. A class defined in app/globals.css is
 * not a Tailwind utility and is skipped. The two lists below are explicit and
 * must stay accurate: an entry that is no longer found, or that now compiles,
 * fails the test.
 * Test: `npx vitest run tests/unit/tailwind-colour-classes-190.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const tailwindConfig = require(join(root, "tailwind.config.js"));
const globalsCss = readFileSync(join(root, "app", "globals.css"), "utf8");

const SCANNED_DIRS = ["app", "components", "lib"];
const SCANNED_FILE = /\.(js|ts|jsx|tsx|mdx)$/;
// Unit tests under lib/ hold fixture strings such as `text-red`, not shipped classes.
const TEST_FILE = /\.test\.[jt]sx?$/;
const CLASS = /(?<![\w-])-?(?:text|bg|border)-[a-z][a-z0-9-]*(?:\/\d+)?(?![\w$/-])/g;

/** Matches the class shape but is not a class: CSS property names in inline styles, and prose. */
const NOT_A_CLASS: Record<string, string> = {
  "border-radius": "CSS property in e-mail and OG inline styles",
  "border-top": "CSS property in e-mail inline styles",
  "text-align": "CSS property in lib/performance/css-optimizer.ts",
  "text-based": "prose in an admin label",
  "text-generation": "prose in the OG image route",
};

/** Real classes with no colour today, left for a later #190 PR. Shrink only. */
const KNOWN_DEAD: Record<string, string> = {
  "bg-sidebar": "components/ui/sidebar.tsx: no --sidebar colour tokens",
  "border-sidebar-border": "components/ui/sidebar.tsx: no --sidebar colour tokens",
  "text-sidebar-foreground": "components/ui/sidebar.tsx: no --sidebar colour tokens",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (SCANNED_FILE.test(name) && !TEST_FILE.test(name)) out.push(relative(root, path).split(sep).join("/"));
  }
  return out;
}

/** Each candidate class and the files that use it. */
function collectClasses(): Map<string, string[]> {
  const uses = new Map<string, string[]>();
  for (const file of SCANNED_DIRS.flatMap((dir) => walk(join(root, dir)))) {
    for (const match of readFileSync(join(root, file), "utf8").matchAll(CLASS)) {
      const cls = match[0].replace(/^-/, "");
      uses.set(cls, [...(uses.get(cls) ?? []), file]);
    }
  }
  return uses;
}

/** The class names Tailwind emits a rule for, unescaped. */
async function emitted(classes: string[]): Promise<Set<string>> {
  const result = await postcss([tailwindcss({ ...tailwindConfig, content: [{ raw: classes.join(" ") }] })]).process(
    "@tailwind utilities;",
    { from: undefined },
  );
  const names = new Set<string>();
  result.root.walkRules((rule) => {
    for (const selector of rule.selectors) {
      const match = /^\.((?:\\.|[\w-])+)/.exec(selector);
      if (match) names.add(match[1].replace(/\\/g, ""));
    }
  });
  return names;
}

/** A class app/globals.css defines itself (`.text-gradient`), not a Tailwind utility. */
function definedInGlobals(cls: string): boolean {
  return new RegExp(`\\.${cls.replace(/[/]/g, "\\\\/")}(?![\\w-])`).test(globalsCss);
}

describe("text-/bg-/border- classes resolve (#190)", () => {
  it("compiles every class used in source to a Tailwind utility", async () => {
    const uses = collectClasses();
    expect(uses.size, "classes found").toBeGreaterThan(100);
    const compiled = await emitted([...uses.keys()]);
    const dead = [...uses.keys()]
      .filter((cls) => !compiled.has(cls) && !definedInGlobals(cls))
      .filter((cls) => !(cls in NOT_A_CLASS) && !(cls.replace(/\/\d+$/, "") in KNOWN_DEAD))
      .map((cls) => `${cls} (${[...new Set(uses.get(cls))].join(", ")})`);
    expect(dead, "classes with no Tailwind definition; add the colour to tailwind.config.js").toEqual([]);
  });

  it("keeps both lists accurate", async () => {
    const uses = collectClasses();
    const listed = [...Object.keys(NOT_A_CLASS), ...Object.keys(KNOWN_DEAD)];
    for (const cls of listed) expect(uses.has(cls), `${cls} is still found in source`).toBe(true);
    const compiled = await emitted(listed);
    for (const cls of Object.keys(KNOWN_DEAD)) {
      expect(compiled.has(cls), `${cls} now compiles; remove it from KNOWN_DEAD`).toBe(false);
    }
  });
});
