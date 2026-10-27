// @vitest-environment jsdom
/**
 * #323: the home top-3 cards line up.
 *
 * Why: a card with no SWE-bench value dropped the column, so Score moved and the
 * metrics row sat at a different height; the #1 badge used a class that emitted no CSS.
 * What: renders HeroCard with and without a SWE-bench score and checks both metric
 * columns are present (em dash for the missing value), the metrics row is pinned to the
 * card bottom, the description keeps its three-line slot, and the #1 card carries no
 * scale transform and a styled badge.
 * Test: `npx vitest run tests/unit/hero-card-323.test.tsx`. No network.
 */
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { HeroCard } from "../../components/ranking/hero-card";

afterEach(cleanup);

function row(swe?: number) {
  return {
    rank: 2,
    tool: { id: "id-fixture", slug: "made-up-tool", name: "Made Up Tool", category: "code-editor", status: "active" },
    scores: { overall: 81.25, agentic_capability: 7, innovation: 7 },
    metrics: swe === undefined ? {} : { swe_bench_score: swe },
  };
}

/** The metrics grid: the element holding the "Score" label. */
function metricsRow(container: HTMLElement) {
  const label = [...container.querySelectorAll("span")].find((s) => s.textContent === "Score");
  return label?.parentElement?.parentElement as HTMLElement;
}

describe("HeroCard metrics row (#323)", () => {
  it("keeps the SWE-bench column with an em dash when the value is missing", () => {
    const { container } = render(<HeroCard ranking={row()} index={1} />);
    const metrics = metricsRow(container);
    expect(metrics.children).toHaveLength(2);
    expect(metrics.children[0]?.textContent).toBe("Score81.3");
    expect(metrics.children[1]?.textContent).toBe("SWE-bench—");
    expect(metrics.className).toContain("mt-auto");
  });

  it("shows the SWE-bench value when present", () => {
    const { container } = render(<HeroCard ranking={row(61.5)} index={1} />);
    expect(metricsRow(container).children[1]?.textContent).toBe("SWE-bench61.5%");
  });

  it("reserves three description lines even with no description", () => {
    const { container } = render(<HeroCard ranking={row()} index={1} />);
    const desc = container.querySelector("p.line-clamp-3");
    expect(desc?.className).toContain("min-h-[3.75rem]");
  });

  it("highlights #1 without scaling it and gives the badge a real background class", () => {
    const { container, getByText } = render(<HeroCard ranking={row()} index={0} />);
    const card = container.querySelector("a > div") as HTMLElement;
    expect(card.className).not.toMatch(/scale-/);
    expect(card.className).toContain("h-full");
    expect(getByText(/#1 Ranked/).className).toContain("gradient-primary");
  });
});
