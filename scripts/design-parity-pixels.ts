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
 * to the chosen set's class strings. For each mapping, mode (light, and
 * `.dark` on `<html>`) and state (rest, hover, active) it renders one slot on
 * a `bg-background` page, in the element the page uses (`div`, `a` or
 * `button`, `input`, or an `svg` icon drawn in `currentColor`), so global
 * element rules such as `a:hover` apply as they do on the page. It shoots the old class/style, swaps the same element to the
 * token class/style and shoots again, then swaps back to the old one for a
 * control shot. It prints the differing-pixel count for token vs old and
 * control vs old. Exit 0 only when every parity mapping and control is 0 and
 * every `expectDiff` mapping (the deliberate one-step change) is non-zero.
 * The `190e2a` and `190e2b` sets build each mapping from the table in
 * `scripts/design-class-maps.ts`, so it renders the substitutions the
 * class-diff check accepts.
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
import { CLASS_MAPS, type ClassMap } from "./design-class-maps";
import { countDiffPixels } from "./pixel-diff";

/** One side of a mapping: a class string, an inline style, or both. */
interface Look {
  className?: string;
  style?: string;
}

type State = "rest" | "hover" | "active";

interface Mapping {
  name: string;
  old: Look;
  token: Look;
  /** The element the page renders; default `div`. */
  element?: "div" | "a" | "button" | "input" | "svg";
  /** States to shoot; default rest only. `active` holds the mouse button down. */
  states?: ReadonlyArray<State>;
  /** A deliberate change: passes only when token and old differ. */
  expectDiff?: boolean;
  /** Modes to shoot; default light and dark. */
  modes?: ReadonlyArray<(typeof MODES)[number]>;
}

const tags = (hue: string): Mapping => ({
  name: `${hue} tag badge (light-only)`,
  old: { className: `bg-${hue}-100 text-${hue}-800 border-${hue}-200` },
  token: { className: `bg-${hue}-100 text-${hue}-800 border-ds-border-tag-${hue}` },
});

const LINK_STATES: ReadonlyArray<State> = ["rest", "hover", "active"];
// The class strings app/error.tsx and both not-found.tsx put on their links.
const LINK_PRIMARY = "bg-ds-accent-cat-blue text-ds-text-on-fill hover:text-ds-text-on-fill active:text-ds-text-on-fill";
const LINK_SECONDARY =
  "border-ds-border-paper bg-ds-surface-paper text-ds-accent-cat-blue hover:text-ds-accent-cat-blue active:text-ds-accent-cat-blue";

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
    states: ["rest", "hover"],
  },
  { name: "heading green-700", old: { className: "text-green-700" }, token: { className: "text-ds-success-fixed" } },
  // signup-for-updates-modal and contact-form.
  { name: "tag blue-100 / 900@30", old: { className: "bg-blue-100 dark:bg-blue-900/30" }, token: { className: "bg-ds-surface-tag-blue" } },
  { name: "tag green-100 / 900@30", old: { className: "bg-green-100 dark:bg-green-900/30" }, token: { className: "bg-ds-surface-tag-green" } },
  { name: "check green-600 / 400", old: { className: "text-green-600 dark:text-green-400" }, token: { className: "text-ds-text-callout-success" } },
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
  // The pages' links sit under the global `a`, `a:hover` and `a:active`
  // colour rules, and the error page's button under the button rules.
  {
    name: "link primary #3b82f6 / white",
    element: "a",
    states: LINK_STATES,
    old: { style: "background-color: #3b82f6; color: white" },
    token: { className: LINK_PRIMARY },
  },
  {
    name: "button primary #3b82f6 / white",
    element: "button",
    states: LINK_STATES,
    old: { style: "background-color: #3b82f6; color: white" },
    token: { className: "bg-ds-accent-cat-blue text-ds-text-on-fill" },
  },
  {
    name: "link secondary white / #3b82f6 / 1px #e5e7eb",
    element: "a",
    states: LINK_STATES,
    old: { style: "background-color: white; color: #3b82f6; border: 1px solid #e5e7eb" },
    token: {
      className: LINK_SECONDARY,
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

const ALL_STATES: ReadonlyArray<State> = ["rest", "hover", "active"];

/** A class string with each word replaced through `map` (pairs first; variants and `/opacity` kept). */
function mapClasses(classes: string, map: ClassMap): string {
  let out = ` ${classes} `;
  for (const [pair, token] of Object.entries(map.pairs)) out = out.replace(` ${pair} `, ` ${token} `);
  return out
    .trim()
    .split(/\s+/)
    .map((word) => {
      const match = /^((?:[^\s:]+:)*)([^/]+)(\/.+)?$/.exec(word);
      const token = match ? map.classes[match[2]] : undefined;
      return match && token ? `${match[1]}${token}${match[3] ?? ""}` : word;
    })
    .join(" ");
}

/** Builders for one `CLASS_MAPS` set: a class string or an inline hex vs its table mapping, at rest, hover and active. */
function tableMappings(setName: string) {
  const map = CLASS_MAPS[setName];
  const cls = (classes: string, element: NonNullable<Mapping["element"]> = "div"): Mapping => {
    const token = mapClasses(classes, map);
    if (token === classes) throw new Error(`${setName}: no table entry maps "${classes}"`);
    return { name: `${element} ${classes}`, element, states: ALL_STATES, old: { className: classes }, token: { className: token } };
  };
  const inline = (style: string, hex: string, element: NonNullable<Mapping["element"]> = "div"): Mapping => ({
    name: `${element} ${style}`,
    element,
    states: ALL_STATES,
    old: { style },
    token: { style: style.replace(hex, map.inline[hex]) },
  });
  return { cls, inline };
}

const { cls: e2a, inline: e2aInline } = tableMappings("190e2a");

/** #190 E2a: admin components and the SEO dashboard, each in the element it is used on. */
const SET_190E2A: Mapping[] = [
  // Paper surfaces, borders and text: cards, stat tiles, labels, skeletons, overlay.
  ...["bg-white", "bg-gray-50", "bg-gray-100", "bg-gray-200", "border-gray-200", "bg-black/50"].map((c) => e2a(c)),
  ...["text-gray-400", "text-gray-500", "text-gray-600"].map((c) => e2a(c)),
  ...["text-gray-400", "text-gray-600"].map((c) => e2a(c, "svg")),
  // Status text, icons, dots, and alert and card surfaces.
  ...["text-green-600", "text-green-700", "text-red-600", "bg-green-50", "bg-red-50", "border-green-200", "border-red-200"].map(
    (c) => e2a(c),
  ),
  ...["text-green-500", "text-green-600", "text-red-600"].map((c) => e2a(c, "svg")),
  ...["bg-red-500", "bg-blue-500", "bg-yellow-500"].map((c) => e2a(c)),
  e2a("text-red-600 dark:text-red-400"),
  e2a("text-green-600 dark:text-green-400"),
  // Category accents: section tiles (white text on the fill), counts, icons.
  ...["bg-green-500", "bg-orange-500", "bg-yellow-500", "bg-purple-500"].map((c) => e2a(`${c} text-white`)),
  ...["text-blue-600", "text-yellow-600", "text-orange-600"].map((c) => e2a(c)),
  ...["text-blue-600", "text-yellow-500"].map((c) => e2a(c, "svg")),
  // rankings-viewer rows are links; the article delete control is an outline button.
  e2a("bg-gray-50 hover:bg-gray-100", "a"),
  e2a("hover:bg-gray-50", "a"),
  e2a("text-red-600 hover:text-red-700 hover:bg-red-50", "button"),
  // Inline colours: the db-status card's left edge, the back-to-website bar and its link.
  e2aInline("border-left: 4px solid; border-left-color: #3b82f6", "#3b82f6"),
  e2aInline("border-left: 4px solid; border-left-color: #ef4444", "#ef4444"),
  e2aInline("border-bottom: 1px solid #e5e7eb", "#e5e7eb"),
  e2aInline("background: #f0fdf4", "#f0fdf4"),
  e2aInline("background: #22c55e; color: white; text-decoration: none", "#22c55e", "a"),
  e2aInline("background: #16a34a; color: white; text-decoration: none", "#16a34a", "a"),
  // The controls: a one-step change, and the row link losing its hover variant.
  {
    name: "CONTROL one step green-600 to --ds-success-fixed (green-700)",
    old: { className: "text-green-600" },
    token: { className: "text-ds-success-fixed" },
    expectDiff: true,
  },
  {
    name: "CONTROL a bg-gray-50 hover:bg-gray-100 without its hover variant",
    element: "a",
    states: ["hover"],
    old: { className: "bg-gray-50 hover:bg-gray-100" },
    token: { className: "bg-ds-surface-paper-muted" },
    expectDiff: true,
  },
];

const { cls: e2b } = tableMappings("190e2b");

/** #190 E2b-1: the auth components, each class string as the component writes it, in its element. */
const SET_190E2B: Mapping[] = [
  // no-auth-header: the dev-mode label and its email chip.
  e2b("text-sm text-gray-600"),
  e2b("rounded-md bg-gray-100"),
  // clerk-debug panel.
  e2b("bg-black/80 text-white rounded text-xs"),
  // clerk-header: the Sign In and Sign Up buttons (unmapped classes stay).
  e2b("text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50", "button"),
  e2b("text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700", "button"),
  // user-button-with-admin fallback avatar skeleton.
  e2b("rounded-full bg-gray-200"),
  // no-auth-provider: the staging tooltip, the dev dropdown, its admin link and sign-out button.
  e2b("bg-gray-900 text-white text-sm rounded-lg shadow-lg"),
  e2b("bg-white rounded-md shadow-lg border border-gray-200"),
  e2b("flex items-center text-sm text-gray-700 hover:bg-gray-100", "a"),
  e2b("w-full text-left text-sm text-gray-700 hover:bg-gray-100", "button"),
  // The controls: a light-only match must show in dark, and the admin link losing its hover variant must show.
  {
    name: "CONTROL bg-gray-900 to --ds-surface-signal (gray-900 in light only), dark",
    modes: ["dark"],
    old: { className: "bg-gray-900" },
    token: { className: "bg-ds-surface-signal" },
    expectDiff: true,
  },
  {
    name: "CONTROL a text-gray-700 hover:bg-gray-100 without its hover background",
    element: "a",
    states: ["hover"],
    old: { className: "text-gray-700 hover:bg-gray-100" },
    token: { className: "text-gray-700" },
    expectDiff: true,
  },
];

export const SETS: Record<string, Mapping[]> = { "190e1": SET_190E1, "190e2a": SET_190E2A, "190e2b": SET_190E2B };

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

/** Applies one look to the slot, puts it in `state`, and returns its screenshot. */
async function shoot(page: Page, look: Look, state: State): Promise<Buffer> {
  await page.mouse.move(0, 0);
  await page.evaluate(
    // The previous `active` shot ends by dragging off the slot with the button
    // held, which selects a div's text; clear it so it is not in this shot.
    `(() => { window.getSelection().removeAllRanges(); const s = document.getElementById("slot"); s.setAttribute("class", ${JSON.stringify(`${SLOT_CLASS} ${look.className ?? ""}`)}); s.setAttribute("style", ${JSON.stringify(`${SLOT_STYLE} ${look.style ?? ""}`)}); })()`,
  );
  if (state !== "rest") await page.hover("#slot");
  if (state === "active") await page.mouse.down();
  const shot = await page.locator("#slot").screenshot({ animations: "disabled" });
  if (state === "active") {
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
  return shot;
}

/** The slot element: an `a` gets an in-page href so a click does not navigate. */
function slotMarkup(element: NonNullable<Mapping["element"]>): string {
  if (element === "a") return '<a id="slot" href="#slot">Ag 12 ✓</a>';
  if (element === "button") return '<button id="slot" type="button">Ag 12 ✓</button>';
  if (element === "input") return '<input id="slot" value="Ag 12 ✓" readonly>';
  if (element === "svg")
    return '<svg id="slot" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
  return '<div id="slot">Ag 12 ✓</div>';
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
  console.log(`browser: ${process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "bundled"} (${browser.version()})`);
  const failures: string[] = [];
  let rows = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 200 }, deviceScaleFactor: 1 });
    const diffPage = await browser.newPage();
    console.log("mode\tstate\ttoken-vs-old px\tcontrol px\tresult\tmapping");
    for (const mapping of mappings) {
      for (const mode of mapping.modes ?? MODES) {
        await page.setContent(
          `<!doctype html><html class="${mode === "dark" ? "dark" : ""}"><head><style>${css}</style></head>` +
            `<body class="bg-background" style="margin:0;padding:40px">${slotMarkup(mapping.element ?? "div")}</body></html>`,
        );
        for (const state of mapping.states ?? ["rest"]) {
          const oldShot = await shoot(page, mapping.old, state);
          const tokenShot = await shoot(page, mapping.token, state);
          const controlShot = await shoot(page, mapping.old, state);
          const diff = await countDiffPixels(diffPage, oldShot, tokenShot);
          const control = await countDiffPixels(diffPage, oldShot, controlShot);
          const ok = control === 0 && (mapping.expectDiff ? diff !== 0 : diff === 0);
          if (!ok) failures.push(`${mapping.name} (${mode}, ${state})`);
          rows += 1;
          console.log(`${mode}\t${state}\t${diff}\t${control}\t${ok ? "ok" : "FAIL"}\t${mapping.name}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
  const pairs = mappings.filter((m) => !m.expectDiff).length;
  console.log(`${pairs} parity mappings, ${rows} mode/state rows; ${failures.length} failure(s)`);
  if (failures.length > 0) {
    console.error(`FAILED: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
