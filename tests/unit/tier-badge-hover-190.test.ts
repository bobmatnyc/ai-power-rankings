import { describe, expect, it } from "vitest";
import { badgeVariants } from "../../components/ui/badge";
import { getTierColor } from "../../lib/ranking-utils";
import { cn } from "../../lib/utils";

/**
 * A tier badge keeps its tier colour on hover (#190 C2).
 *
 * Why: Badge's default variant carries `hover:bg-primary-hover`. While the
 * tiers were gradients, the background image hid that fill; on the solid
 * `--ds-score-*` bands it turned every tier badge blue on hover.
 * What: merges Badge's default classes with `getTierColor` the way Badge does
 * (`cn`) and requires each tier's hover background to be its own band.
 * Test: `npx vitest run tests/unit/tier-badge-hover-190.test.ts`. No network.
 */
describe("tier badge hover (#190)", () => {
  it.each(["S", "A", "B", "C", "D"])("tier %s keeps its band on hover", (tier) => {
    const classes = cn(badgeVariants(), getTierColor(tier)).split(/\s+/);
    const hoverBackgrounds = classes.filter((cls) => cls.startsWith("hover:bg-"));
    expect(hoverBackgrounds).toEqual([`hover:bg-ds-score-${tier.toLowerCase()}`]);
  });
});
