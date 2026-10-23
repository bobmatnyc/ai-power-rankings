import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, hslToRgb, mix } from "../../app/design/option-data";
import { tokensFor } from "../../scripts/design-tokens";

/**
 * #190 C2: the home page's Autonomous Agents card uses the purple
 * `--ds-accent-agent` accent, not `destructive`.
 *
 * Why: since C1 `destructive` resolves to --ds-danger, so the card read as an
 * error. The owner picked purple (purple-700 light, purple-400 dark).
 * What: cuts the card out of app/[lang]/page.tsx and requires the accent on
 * its hover border, badge tint and link text with no `destructive` class
 * left; requires real error components to keep `destructive`; and checks the
 * link text on the card and the badge text on its 10% tint meet AA in both
 * modes, from the values in app/globals.css.
 * Test: `npx vitest run tests/unit/agent-card-accent-190.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");

/** The Link wrapping the Autonomous Agents card, up to its closing tag. */
function agentCard(): string {
  const page = read("app", "[lang]", "page.tsx");
  const start = page.indexOf("category=autonomous-agent");
  expect(start, "Autonomous Agents card link").toBeGreaterThan(-1);
  const end = page.indexOf("</Link>", start);
  expect(end, "end of the card").toBeGreaterThan(start);
  return page.slice(start, end);
}

describe("Autonomous Agents card accent (#190 C2)", () => {
  it("uses the purple accent and no destructive class", () => {
    const card = agentCard();
    expect(card).not.toMatch(/destructive/);
    expect(card).toContain("hover:border-ds-accent-agent/20");
    expect(card).toContain('<Badge className="bg-ds-accent-agent/10 text-ds-accent-agent">');
    expect(card).toMatch(/<p className="text-sm text-ds-accent-agent mt-3 group-hover:underline">/);
  });

  it("leaves the error uses of destructive in place", () => {
    expect(read("components", "ui", "alert.tsx")).toContain("text-destructive");
    expect(read("components", "error-boundary.tsx")).toContain("text-destructive");
    expect(read("components", "ui", "confirm-dialog.tsx")).toContain("bg-destructive");
  });

  it.each(["light", "dark"] as const)("meets AA for link and badge text, %s mode", (mode) => {
    const tokens = tokensFor(read("app", "globals.css"), mode);
    const accent = tokens.get("--ds-accent-agent");
    const surface = tokens.get("--ds-surface");
    expect(accent, "--ds-accent-agent").toBeDefined();
    const fg = hslToRgb(accent as string);
    const bg = hslToRgb(surface as string);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fg, mix(fg, bg, 0.1))).toBeGreaterThanOrEqual(4.5);
  });
});
