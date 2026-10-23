#!/usr/bin/env tsx
/**
 * Design audit screenshots (#188).
 *
 * Why: the design-system work (#188 tokens, #189 migration, #190 components)
 * must show that a change either leaves pages untouched or changes them on
 * purpose. This captures the same page set before and after a change so the
 * two sets can be compared file by file.
 * What: drives a local Chromium (Playwright) over 9 page types at 375, 768 and
 * 1280 px, in light and dark, and writes full-page PNGs to the gitignored
 * `tmp/design-audit/<label>/<page>-<width>-<mode>.png`. Requests to other origins are
 * blocked so runs repeat. The site has no theme
 * toggle, so dark mode is forced by adding `class="dark"` to `<html>`, which
 * is what Tailwind's `darkMode: ["class"]` keys on. `--compare a,b` compares
 * two captured sets: identical bytes first, then decoded pixels in a canvas.
 * Test: run by hand against a dev server (docs/refresh/design-audit/README.md);
 * it needs a browser and a running site, so it has no unit test.
 *
 * Usage (set PLAYWRIGHT_CHROMIUM_PATH to use a Chromium other than the bundled one):
 *   npx tsx scripts/design-audit-shots.ts --label before --base-url http://localhost:3007
 *   npx tsx scripts/design-audit-shots.ts --compare before,after
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";

/** The 9 page types, one representative route each (public routes under app/[lang]). */
export const PAGE_TYPES: ReadonlyArray<{ name: string; path: string }> = [
  { name: "home", path: "/en" },
  { name: "rankings", path: "/en/rankings" },
  { name: "tools-index", path: "/en/tools" },
  { name: "tool-detail", path: "/en/tools/claude-code" },
  { name: "category-landing", path: "/en/best-ai-coding-tools" },
  { name: "news-index", path: "/en/news" },
  { name: "news-article", path: "/en/news/anthropic-releases-claude-opus-4-1-improved-coding-accuracy" },
  { name: "trending", path: "/en/trending" },
  { name: "content", path: "/en/methodology" },
];

export const WIDTHS = [375, 768, 1280] as const;
export const MODES = ["light", "dark"] as const;

const OUT_ROOT = join(__dirname, "..", "tmp", "design-audit");

// Set when the Chromium build this Playwright version expects is not installed
// (`npx playwright install chromium`); any recent Chromium or Chrome binary works.
const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
  : {};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function capture(label: string, baseUrl: string): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new Error(`--label must be lowercase letters, digits or dashes; got "${label}"`);
  }
  const outDir = join(OUT_ROOT, label);
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(launchOptions);
  const failures: string[] = [];
  try {
    for (const page of PAGE_TYPES) {
      for (const width of WIDTHS) {
        for (const mode of MODES) {
          const file = join(outDir, `${page.name}-${width}-${mode}.png`);
          try {
            await shoot(browser, `${baseUrl}${page.path}`, width, mode, file);
            console.log(`ok   ${file}`);
          } catch (error) {
            failures.push(`${page.name}-${width}-${mode}: ${(error as Error).message}`);
            console.error(`FAIL ${page.name}-${width}-${mode}: ${(error as Error).message}`);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length > 0) {
    console.error(`${failures.length} capture(s) failed`);
    process.exit(1);
  }
}

async function shoot(
  browser: Browser,
  url: string,
  width: number,
  mode: (typeof MODES)[number],
  file: string,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: mode,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    if (mode === "dark") {
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.classList.add("dark");
        });
      });
    }
    // Third-party requests (analytics, remote logos) are blocked: they make
    // runs differ for reasons unrelated to the change under test.
    const origin = new URL(url).origin;
    await page.route("**/*", (route) =>
      route.request().url().startsWith(origin) || route.request().url().startsWith("data:")
        ? route.continue()
        : route.abort(),
    );
    // The dev server keeps an HMR socket open, so "networkidle" may never come;
    // wait for "load", then give idle a short bounded chance.
    const response = await page.goto(url, { waitUntil: "load", timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready);
    if (mode === "dark") {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    }
    // Hide the caret and Next's dev-mode indicator so runs are repeatable.
    await page.addStyleTag({
      content: "*{caret-color:transparent!important} nextjs-portal{display:none!important}",
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
    if (response && response.status() >= 500) {
      console.warn(`warn ${url} answered ${response.status()}`);
    }
  } finally {
    await context.close();
  }
}

/**
 * Browser-side pixel diff, kept as source text: tsx compiles functions with a
 * `__name` helper that does not exist in the page, so a function argument to
 * `page.evaluate` fails there. Returns the count of differing pixels, or -1
 * when the image sizes differ.
 */
const PIXEL_DIFF = `async (da, db) => {
  const load = async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, px: ctx.getImageData(0, 0, img.width, img.height).data };
  };
  const [ia, ib] = await Promise.all([load(da), load(db)]);
  if (ia.w !== ib.w || ia.h !== ib.h) return -1;
  let count = 0;
  for (let i = 0; i < ia.px.length; i += 4) {
    if (ia.px[i] !== ib.px[i] || ia.px[i + 1] !== ib.px[i + 1] || ia.px[i + 2] !== ib.px[i + 2] || ia.px[i + 3] !== ib.px[i + 3]) count += 1;
  }
  return count;
}`;

/** Compares two labelled sets: byte hash first, then decoded pixels for files that differ. */
async function compare(left: string, right: string): Promise<void> {
  const leftDir = join(OUT_ROOT, left);
  const rightDir = join(OUT_ROOT, right);
  for (const dir of [leftDir, rightDir]) {
    if (!existsSync(dir)) throw new Error(`no screenshots at ${dir}`);
  }
  const files = readdirSync(leftDir).filter((f) => f.endsWith(".png")).sort();
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  const rows: string[] = [];
  let different = 0;
  try {
    for (const file of files) {
      const rightFile = join(rightDir, file);
      if (!existsSync(rightFile)) {
        rows.push(`${file}\tMISSING in ${right}`);
        different += 1;
        continue;
      }
      const a = readFileSync(join(leftDir, file));
      const b = readFileSync(rightFile);
      const hash = (buf: Buffer) => createHash("sha256").update(buf).digest("hex").slice(0, 12);
      if (a.equals(b)) {
        rows.push(`${file}\tidentical-bytes\t${hash(a)}`);
        continue;
      }
      const diffPixels = (await page.evaluate(
        `(${PIXEL_DIFF})(${JSON.stringify(`data:image/png;base64,${a.toString("base64")}`)}, ${JSON.stringify(`data:image/png;base64,${b.toString("base64")}`)})`,
      )) as number;
      if (diffPixels === 0) {
        rows.push(`${file}\tidentical-pixels\t(bytes differ)`);
      } else {
        different += 1;
        rows.push(`${file}\tDIFFERENT\t${diffPixels < 0 ? "size changed" : `${diffPixels} px`}`);
      }
    }
  } finally {
    await browser.close();
  }
  const report = rows.join("\n");
  writeFileSync(join(OUT_ROOT, `compare-${left}-${right}.tsv`), `${report}\n`);
  console.log(report);
  console.log(`${files.length} files compared, ${different} different`);
  process.exit(different === 0 ? 0 : 1);
}

async function main(): Promise<void> {
  const pair = arg("compare");
  if (pair) {
    const [left, right] = pair.split(",");
    await compare(left, right);
    return;
  }
  const label = arg("label");
  if (!label) throw new Error("pass --label <before|after|...> or --compare <a>,<b>");
  await capture(label, (arg("base-url") ?? "http://localhost:3007").replace(/\/$/, ""));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
