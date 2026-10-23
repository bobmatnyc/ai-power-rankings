#!/usr/bin/env tsx
/**
 * Per-mapping rendered parity for #190 colour migrations.
 *
 * Why: a token whose value converts to the right hex can still render
 * differently (alpha, a `dark:` variant the token does not carry, an inline
 * shorthand that beats a class). This renders each old/new pair in a real
 * browser with the repo's own stylesheet, so a migration PR can show 0 pixels
 * changed per mapping, and that the check would see a one-step change.
 * What: compiles `app/globals.css` with `tailwind.config.js`, content limited
 * to the chosen set's class strings. For each mapping and mode (light, and
 * `.dark` on `<html>`) it renders one slot on a `bg-background` page, shoots
 * the old class/style, swaps the same element to the token class/style and
 * shoots again, then swaps back to the old one for a control shot. It prints
 * the differing-pixel count for token vs old and control vs old. Exit 0 only
 * when every parity mapping and control is 0 and every `expectDiff` mapping
 * (the deliberate one-step change) is non-zero.
 * Test: run by hand (`npx tsx scripts/design-parity-pixels.ts --set 190e1`);
 * it needs a browser, so it has no unit test. Its `expectDiff` mapping is the
 * proof that it can fail.
 *
 * Set PLAYWRIGHT_CHROMIUM_PATH to use a Chromium other than the bundled one.
 * Add a set to `SETS` for the next migration PR.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { countDiffPixels } from "./pixel-diff";

/** One side of a mapping: a class string, an inline style, or both. */
interface Look {
  className?: string;
  style?: string;
}

interface Mapping {
  name: string;
  old: Look;
  token: Look;
  /** Shoot with the pointer over the slot, for `hover:` classes. */
  hover?: boolean;
  /** A deliberate change: passes only when token and old differ. */
  expectDiff?: boolean;
}

const tags = (hue: string): Mapping => ({
  name: `${hue} tag badge (light-only)`,
  old: { className: `bg-${hue}-100 text-${hue}-800 border-${hue}-200` },
  token: { className: `bg-${hue}-100 text-${hue}-800 border-ds-border-tag-${hue}` },
});

/** #190 E1: public modals, contact form, error and not-found pages. */
const SET_190E1: Mapping[] = [
  // whats-new-modal icons, badges and skeletons.
  { name: "icon purple-600", old: { className: "text-purple-600" }, token: { className: "text-ds-accent-cat-purple-strong" } },
  { name: "icon blue-600", old: { className: "text-blue-600" }, token: { className: "text-ds-accent-fixed" } },
  { name: "icon green-600", old: { className: "text-green-600" }, token: { className: "text-ds-accent-cat-green-strong" } },
  { name: "icon orange-600", old: { className: "text-orange-600" }, token: { className: "text-ds-accent-cat-orange-strong" } },
  ...["purple", "blue", "green", "orange"].map(tags),
  { name: "skeleton gray-200", old: { className: "bg-gray-200" }, token: { className: "bg-ds-surface-skeleton" } },
  // changelog-modal.
  { name: "badge green-600", old: { className: "bg-green-600" }, token: { className: "bg-ds-success-fixed-mid" } },
  {
    name: "badge hover green-700",
    old: { className: "bg-green-600 hover:bg-green-700" },
    token: { className: "bg-ds-success-fixed-mid hover:bg-ds-success-fixed" },
    hover: true,
  },
  { name: "heading green-700", old: { className: "text-green-700" }, token: { className: "text-ds-success-fixed" } },
  // signup-for-updates-modal and contact-form.
  { name: "tag blue-100 / 900@30", old: { className: "bg-blue-100 dark:bg-blue-900/30" }, token: { className: "bg-ds-surface-tag-blue" } },
  { name: "tag green-100 / 900@30", old: { className: "bg-green-100 dark:bg-green-900/30" }, token: { className: "bg-ds-surface-tag-green" } },
  { name: "check green-600 / 400", old: { className: "text-green-600 dark:text-green-400" }, token: { className: "text-ds-text-callout-success" } },
  { name: "mail blue-600 / 400", old: { className: "text-blue-600 dark:text-blue-400" }, token: { className: "text-ds-accent" } },
  { name: "alert border green-200", old: { className: "border-green-200" }, token: { className: "border-ds-success-fixed-border" } },
  { name: "alert border red-200", old: { className: "border-red-200" }, token: { className: "border-ds-danger-fixed-border" } },
  { name: "alert icon red-600 / 400", old: { className: "text-red-600 dark:text-red-400" }, token: { className: "text-ds-text-callout-danger" } },
  { name: "dot green-500", old: { className: "bg-green-500" }, token: { className: "bg-ds-success-solid" } },
  { name: "dot blue-500", old: { className: "bg-blue-500" }, token: { className: "bg-ds-accent-cat-blue" } },
  { name: "dot blue-600", old: { className: "bg-blue-600" }, token: { className: "bg-ds-accent-fixed" } },
  // DynamicCharts skeleton, crown icon, optimized-image placeholder.
  { name: "chart skeleton gray-100", old: { className: "bg-gray-100" }, token: { className: "bg-ds-surface-paper-sunken" } },
  { name: "chart label gray-500", old: { className: "text-gray-500" }, token: { className: "text-ds-text-paper-subtle" } },
  { name: "crown yellow-500", old: { className: "text-yellow-500" }, token: { className: "text-ds-accent-cat-yellow" } },
  // error.tsx and the two not-found.tsx: inline colours to classes.
  { name: "page #f9fafb", old: { style: "background-color: #f9fafb" }, token: { className: "bg-ds-surface-paper-muted" } },
  { name: "card white", old: { style: "background-color: white" }, token: { className: "bg-ds-surface-paper" } },
  { name: "text #6b7280", old: { style: "color: #6b7280" }, token: { className: "text-ds-text-paper-subtle" } },
  {
    name: "message #f3f4f6 / #6b7280",
    old: { style: "color: #6b7280; background-color: #f3f4f6" },
    token: { className: "bg-ds-surface-paper-sunken text-ds-text-paper-subtle" },
  },
  {
    name: "primary #3b82f6 / white",
    old: { style: "background-color: #3b82f6; color: white" },
    token: { className: "bg-ds-accent-cat-blue text-ds-text-on-fill" },
  },
  {
    name: "secondary white / #3b82f6 / 1px #e5e7eb",
    old: { style: "background-color: white; color: #3b82f6; border: 1px solid #e5e7eb" },
    token: {
      className: "border-ds-border-paper bg-ds-surface-paper text-ds-accent-cat-blue",
      style: "border-width: 1px; border-style: solid",
    },
  },
  // The control: green-600 to green-700 is one palette step and must show.
  {
    name: "CONTROL one step green-600 to --ds-success-fixed (green-700)",
    old: { className: "text-green-600" },
    token: { className: "text-ds-success-fixed" },
    expectDiff: true,
  },
];

export const SETS: Record<string, Mapping[]> = { "190e1": SET_190E1 };

const ROOT = join(__dirname, "..");
const MODES = ["light", "dark"] as const;
// The slot carries a 4px border so border colours show; a mapping's inline
// `border` shorthand still overrides it, as on the page.
const SLOT_CLASS = "border-4 p-2";
const SLOT_STYLE = "width: 240px; height: 72px; font: bold 28px/1 Arial, sans-serif;";

async function compileCss(mappings: Mapping[]): Promise<string> {
  const html = mappings.map((m) => `<div class="${SLOT_CLASS} ${m.old.className ?? ""} ${m.token.className ?? ""}"></div>`).join("\n");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require(join(ROOT, "tailwind.config.js"));
  const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
  const result = await postcss([tailwindcss({ ...config, content: [{ raw: html, extension: "html" }] })]).process(css, {
    from: join(ROOT, "app", "globals.css"),
  });
  return result.css;
}

/** Applies one look to the slot and returns its screenshot. */
async function shoot(page: Page, look: Look, hover: boolean): Promise<Buffer> {
  await page.evaluate(
    `(() => { const s = document.getElementById("slot"); s.className = ${JSON.stringify(`${SLOT_CLASS} ${look.className ?? ""}`)}; s.setAttribute("style", ${JSON.stringify(`${SLOT_STYLE} ${look.style ?? ""}`)}); })()`,
  );
  if (hover) await page.hover("#slot");
  else await page.mouse.move(0, 0);
  return page.locator("#slot").screenshot({ animations: "disabled" });
}

async function main(): Promise<void> {
  const index = process.argv.indexOf("--set");
  const setName = index >= 0 ? process.argv[index + 1] : "";
  const mappings = SETS[setName];
  if (!mappings) throw new Error(`pass --set <${Object.keys(SETS).join("|")}>`);
  const css = await compileCss(mappings);
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  );
  const failures: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 200 }, deviceScaleFactor: 1 });
    const diffPage = await browser.newPage();
    console.log("mode\ttoken-vs-old px\tcontrol px\tresult\tmapping");
    for (const mapping of mappings) {
      for (const mode of MODES) {
        await page.setContent(
          `<!doctype html><html class="${mode === "dark" ? "dark" : ""}"><head><style>${css}</style></head>` +
            `<body class="bg-background" style="margin:0;padding:40px"><div id="slot">Ag 12 ✓</div></body></html>`,
        );
        const hover = mapping.hover ?? false;
        const oldShot = await shoot(page, mapping.old, hover);
        const tokenShot = await shoot(page, mapping.token, hover);
        const controlShot = await shoot(page, mapping.old, hover);
        const diff = await countDiffPixels(diffPage, oldShot, tokenShot);
        const control = await countDiffPixels(diffPage, oldShot, controlShot);
        const ok = control === 0 && (mapping.expectDiff ? diff !== 0 : diff === 0);
        if (!ok) failures.push(`${mapping.name} (${mode})`);
        console.log(`${mode}\t${diff}\t${control}\t${ok ? "ok" : "FAIL"}\t${mapping.name}`);
      }
    }
  } finally {
    await browser.close();
  }
  const pairs = mappings.filter((m) => !m.expectDiff).length;
  console.log(`${pairs} parity mappings x ${MODES.length} modes; ${failures.length} failure(s)`);
  if (failures.length > 0) {
    console.error(`FAILED: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
