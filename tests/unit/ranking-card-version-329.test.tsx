// @vitest-environment jsdom
/**
 * #329: the ranking card shows a model's version.
 *
 * Why: the owner ruled that every ranked model shows its version.
 * What: renders RankingCard with `tool.version` set ("Version 5.5" appears) and with it
 *   null or absent (no version element, no "undefined", no bare "Version" label).
 * Test: `npx vitest run tests/unit/ranking-card-version-329.test.tsx`. No network.
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import { RankingCard } from "../../components/ranking/ranking-card";

afterEach(cleanup);

function ranking(version: string | null | undefined) {
  return {
    rank: 4,
    tool: {
      id: "t1",
      slug: "alpha",
      name: "Alpha",
      category: "model",
      status: "active",
      ...(version === undefined ? {} : { version }),
    },
    scores: { overall: 50, agentic_capability: 5, innovation: 5 },
    metrics: {},
  } as Parameters<typeof RankingCard>[0]["ranking"];
}

describe("RankingCard version (#329)", () => {
  // One test per contract: the null cases are checked on the same card that showed a version,
  // so the test fails when the card never renders one.
  it.each([null, undefined])("shows the version when set and nothing extra when it is %s", (version) => {
    const { getByTestId, queryByTestId, container, rerender } = render(<RankingCard ranking={ranking("5.5")} />);
    expect(getByTestId("model-version").textContent).toBe("Version 5.5");
    rerender(<RankingCard ranking={ranking(version)} />);
    expect(queryByTestId("model-version")).toBeNull();
    expect(container.textContent).not.toMatch(/undefined|null|Version/);
  });
});
