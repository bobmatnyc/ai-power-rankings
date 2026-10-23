#!/usr/bin/env tsx
/**
 * Build the design-token swatch page (#188).
 *
 * Why: the owner approves the token look from rendered output before any page
 * uses the tokens (#190 brings the in-app `/design` page). A static file needs
 * no dev server, database or login.
 * What: reads the `#188 design-system tokens` layer from app/globals.css with
 * the same parser the token test uses, inlines the whole stylesheet's custom
 * properties, and writes `tmp/design-swatches.html` (gitignored): one light and
 * one dark panel side by side, each showing every colour swatch with its
 * contrast pairs, the type scale, spacing, radius, shadow and motion tokens.
 * Test: the parser it relies on is covered by tests/unit/design-tokens-188.test.ts;
 * the page itself is checked by eye.
 *
 * Usage: npx tsx scripts/build-design-swatches.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AA_PAIRS, contrast, hslToHex, tokensFor, type Mode } from "./design-tokens";

const root = join(__dirname, "..");
const css = readFileSync(join(root, "app", "globals.css"), "utf8");
const outFile = join(root, "tmp", "design-swatches.html");

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The two `@layer base` variable blocks: existing tokens (incl. #178) plus the #188 layer. */
function variableCss(): string {
  // Only custom-property rules are needed; Tailwind directives and component
  // styles would need a build. Keep every `:root` / `.dark` / media rule.
  const end = css.indexOf("/* #188 design-system tokens END");
  return css
    .slice(0, css.indexOf("*/", end) + 2)
    .replace(/@tailwind[^;]+;/g, "")
    .replace(/@layer base \{/g, "@layer tokens {");
}

function panel(mode: Mode): string {
  const tokens = tokensFor(css, mode);
  const names = [...tokens.keys()];
  const colours = names.filter((n) => /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/.test(tokens.get(n) ?? "") && n !== "--ds-shadow-color");
  const group = (re: RegExp) => names.filter((n) => re.test(n));
  const swatches = colours
    .map((n) => {
      const value = tokens.get(n) ?? "";
      return `<div class="sw"><span class="chip" style="background:hsl(var(${n}))"></span><code>${n}</code><small>${value} · ${hslToHex(value)}</small></div>`;
    })
    .join("");
  const pairs = AA_PAIRS.map(([fg, bg]) => {
    const ratio = contrast(hslToHex(tokens.get(`--${fg}`) ?? ""), hslToHex(tokens.get(`--${bg}`) ?? ""));
    return `<div class="pair" style="color:hsl(var(--${fg}));background:hsl(var(--${bg}))">--${fg} on --${bg} <b>${ratio.toFixed(2)}</b></div>`;
  }).join("");
  const rank = ["--ds-rank-up", "--ds-rank-down", "--ds-rank-steady"]
    .map((n) => `<div class="sw"><span class="chip" style="background:hsl(var(${n}))"></span><code>${n}</code><small>#178</small></div>`)
    .join("");
  const type = group(/^--ds-font-size-/)
    .map((n) => `<div style="font-size:var(${n});line-height:var(--ds-line-height-heading)">${n.replace("--ds-font-size-", "")} <code>${n}</code></div>`)
    .join("");
  const weights = group(/^--ds-font-weight-|^--ds-line-height-/)
    .map((n) => `<div><code>${n}</code> = ${escape(tokens.get(n) ?? "")}</div>`)
    .join("");
  const space = group(/^--ds-space-/)
    .map((n) => `<div class="row"><span class="bar" style="width:var(${n})"></span><code>${n}</code> ${tokens.get(n)}</div>`)
    .join("");
  const radius = group(/^--ds-radius-/)
    .map((n) => `<div class="box" style="border-radius:var(${n})"><code>${n}</code></div>`)
    .join("");
  const shadow = group(/^--ds-shadow-(sm|md|lg)$/)
    .map((n) => `<div class="box" style="box-shadow:var(${n})"><code>${n}</code></div>`)
    .join("");
  const motion = group(/^--ds-(duration|ease)-/)
    .map((n) => `<div class="row"><span class="dot" style="transition:transform var(--ds-duration-base) var(${n.startsWith("--ds-ease") ? n : "--ds-ease-standard"});transition-duration:var(${n.startsWith("--ds-duration") ? n : "--ds-duration-slow"})"></span><code>${n}</code> ${escape(tokens.get(n) ?? "")}</div>`)
    .join("");
  return `<section class="${mode === "dark" ? "dark" : "light"} panel">
<h2>${mode}</h2>
<h3>Colour</h3><div class="grid">${swatches}</div>
<h3>Rank (#178, unchanged)</h3><div class="grid">${rank}</div>
<h3>Text / surface contrast (WCAG AA ≥ 4.5)</h3>${pairs}
<h3>Type scale</h3>${type}${weights}
<h3>Spacing</h3>${space}
<h3>Radius</h3><div class="flex">${radius}</div>
<h3>Shadow</h3><div class="flex">${shadow}</div>
<h3>Motion (hover a row)</h3>${motion}
</section>`;
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>AI Power Rankings — design tokens (#188)</title>
<style>
${variableCss()}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{display:grid;grid-template-columns:1fr 1fr}
@media (max-width:900px){main{grid-template-columns:1fr}}
.panel{padding:var(--ds-space-lg);background:hsl(var(--ds-surface));color:hsl(var(--ds-text))}
.panel h3{margin:var(--ds-space-xl) 0 var(--ds-space-sm);font-size:var(--ds-font-size-lead)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--ds-space-sm)}
.sw{display:flex;flex-direction:column;gap:2px;font-size:12px}
.chip{display:block;height:40px;border-radius:var(--ds-radius-control);border:1px solid hsl(var(--ds-border))}
small{color:hsl(var(--ds-text-muted))}
.pair{padding:var(--ds-space-xs) var(--ds-space-sm);margin:2px 0;border-radius:var(--ds-radius-control);font-size:14px}
.row{display:flex;align-items:center;gap:var(--ds-space-sm);margin:4px 0;font-size:13px}
.bar{display:inline-block;height:12px;background:hsl(var(--ds-accent))}
.flex{display:flex;flex-wrap:wrap;gap:var(--ds-space-md)}
.box{padding:var(--ds-space-md);min-width:140px;background:hsl(var(--ds-surface-raised));border:1px solid hsl(var(--ds-border));font-size:12px}
.dot{display:inline-block;width:14px;height:14px;border-radius:9999px;background:hsl(var(--ds-accent))}
.row:hover .dot{transform:translateX(80px)}
</style></head>
<body><main>${panel("light")}${panel("dark")}</main></body></html>
`;

mkdirSync(join(root, "tmp"), { recursive: true });
writeFileSync(outFile, html);
console.log(`wrote ${outFile}`);
