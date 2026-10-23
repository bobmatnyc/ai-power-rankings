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
 * `--set states` captures `STATE_SHOTS` instead: open modals, the contact
 * page and the not-found pages (#190 E1), each reached by its own steps.
 * Test: run by hand against a dev server (docs/refresh/design-audit/README.md);
 * it needs a browser and a running site, so it has no unit test.
 *
 * Usage (set PLAYWRIGHT_CHROMIUM_PATH to use a Chromium other than the bundled one):
 *   npx tsx scripts/design-audit-shots.ts --label before --base-url http://localhost:3007
 *   npx tsx scripts/design-audit-shots.ts --label states-before --set states
 *   npx tsx scripts/design-audit-shots.ts --compare before,after
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { countDiffPixels } from "./pixel-diff";

/**
 * One screenshot target. `steps` run after load, in order: `click` and
 * `waitFor` take a Playwright selector. `viewport` shoots the viewport only,
 * for a modal over a page whose height varies between runs. `mocks` answer a
 * same-origin URL glob with fixed JSON, or `hold` it unanswered to keep a
 * loading state on screen.
 */
export interface Shot {
  name: string;
  path: string;
  steps?: ReadonlyArray<{ click: string } | { waitFor: string }>;
  viewport?: boolean;
  mocks?: ReadonlyArray<{ url: string; json?: unknown; hold?: true }>;
}

/** The 9 page types, one representative route each (public routes under app/[lang]). */
export const PAGE_TYPES: ReadonlyArray<Shot> = [
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

// #190 E1: public modals, the contact page and the not-found pages. The home
// page opens the what's-new modal itself after 2 s in a fresh browser. An
// unmatched URL renders app/not-found.tsx; notFound() inside [lang] (the
// contact page with an unknown slug) renders app/[lang]/not-found.tsx.
// The feed fixture holds one item of each kind, so every icon and badge colour
// shows; its fixed past date keeps the "Nd ago" label equal within a day.
const DIALOG = '[role="dialog"]';
const FEED_URL = "**/api/whats-new?days=7";
const SUMMARY_URL = "**/api/whats-new/summary";
const FEED_DATE = "2020-01-01T00:00:00.000Z";
const FEED_FIXTURE = {
  feed: [
    { type: "news", date: FEED_DATE, id: "n1", slug: "n1", title: "News item", summary: "Summary", published_at: FEED_DATE, source: "Source" },
    { type: "tool", date: FEED_DATE, id: "t1", name: "Tool item", slug: "t1", description: "Description", updatedAt: FEED_DATE, category: "ide-assistant" },
    ...(["feature", "improvement", "fix", "news"] as const).map((changeType) => ({
      type: "platform",
      date: FEED_DATE,
      id: `p-${changeType}`,
      title: `Platform ${changeType}`,
      description: "Description",
      category: "Platform",
      changeType,
      version: "1.0.0",
    })),
  ],
};
export const STATE_SHOTS: ReadonlyArray<Shot> = [
  {
    name: "whats-new-loading",
    path: "/en",
    mocks: [{ url: FEED_URL, hold: true }],
    steps: [{ waitFor: DIALOG }],
    viewport: true,
  },
  {
    name: "whats-new-recent",
    path: "/en",
    mocks: [{ url: FEED_URL, json: FEED_FIXTURE }],
    steps: [{ waitFor: `${DIALOG} >> text=Platform feature` }],
    viewport: true,
  },
  {
    name: "whats-new-summary-loading",
    path: "/en",
    mocks: [
      { url: FEED_URL, json: FEED_FIXTURE },
      { url: SUMMARY_URL, hold: true },
    ],
    steps: [{ waitFor: DIALOG }, { click: `${DIALOG} >> text=Monthly Summary` }],
    viewport: true,
  },
  { name: "contact", path: "/en/contact/default" },
  {
    name: "signup-modal",
    path: "/en/contact/default",
    steps: [{ click: "text=Sign Up for Updates" }, { waitFor: DIALOG }],
    viewport: true,
  },
  { name: "not-found", path: "/en/no-such-page-190e1" },
  { name: "not-found-localized", path: "/en/contact/no-such-slug" },
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

async function capture(label: string, baseUrl: string, shots: ReadonlyArray<Shot>): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new Error(`--label must be lowercase letters, digits or dashes; got "${label}"`);
  }
  const outDir = join(OUT_ROOT, label);
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(launchOptions);
  const failures: string[] = [];
  try {
    for (const page of shots) {
      for (const width of WIDTHS) {
        for (const mode of MODES) {
          const file = join(outDir, `${page.name}-${width}-${mode}.png`);
          try {
            await shoot(browser, `${baseUrl}${page.path}`, width, mode, file, page);
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
  shot: Shot,
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
    // Registered after the catch-all, so these take precedence for their URLs.
    for (const mock of shot.mocks ?? []) {
      await page.route(mock.url, (route) =>
        mock.hold ? undefined : route.fulfill({ json: mock.json }),
      );
    }
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
    await runSteps(page, shot.steps ?? []);
    await page.waitForTimeout(500);
    await page.screenshot({ path: file, fullPage: !shot.viewport, animations: "disabled" });
    if (response && response.status() >= 500) {
      console.warn(`warn ${url} answered ${response.status()}`);
    }
  } finally {
    await context.close();
  }
}

/** Runs a shot's steps, then lets the requests they start settle (bounded). */
async function runSteps(page: Page, steps: NonNullable<Shot["steps"]>): Promise<void> {
  for (const step of steps) {
    if ("click" in step) await page.locator(step.click).first().click({ timeout: 30_000 });
    else await page.locator(step.waitFor).first().waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  }
  if (steps.length > 0) await page.waitForTimeout(1_000);
}

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
      const diffPixels = await countDiffPixels(page, a, b);
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
  const set = arg("set") ?? "pages";
  if (set !== "pages" && set !== "states") throw new Error(`--set must be pages or states; got "${set}"`);
  const shots = set === "states" ? STATE_SHOTS : PAGE_TYPES;
  await capture(label, (arg("base-url") ?? "http://localhost:3007").replace(/\/$/, ""), shots);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
