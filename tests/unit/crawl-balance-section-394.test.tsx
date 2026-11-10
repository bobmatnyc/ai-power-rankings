// @vitest-environment jsdom
/**
 * #394: the balance cross-check section never shows a stale comparison.
 *
 * Why: a reload that fails must not leave the previous "in agreement" on
 *   screen under the error banner.
 * What: renders the section with a stubbed `fetch`, resolves a first load that
 *   agrees, then fails a reload and checks that only the error shows.
 * Test: `npx vitest run tests/unit/crawl-balance-section-394.test.tsx`. No network.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CrawlBalanceSection from "../../app/[lang]/(authenticated)/admin/crawl-monitor/crawl-balance-section";
import type { BalanceCheckSummary } from "../../lib/crawl-monitor/balances";

const AGREES: BalanceCheckSummary = {
  generatedAt: "2030-03-15T12:00:00.000Z",
  ledgerAvailable: true,
  providers: [
    {
      provider: "openrouter",
      label: "OpenRouter (LLM)",
      balance: { state: "ok", reported: { unit: "usd", period: "utc_month", used: 0.305, remaining: 37.5 } },
      recorded: { calls: 2, unpricedCalls: 0, costUsd: 0.3, units: null, unitLabel: "tokens" },
      agreement: { status: "agrees", difference: 0.005 },
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CrawlBalanceSection reload", () => {
  it("clears the previous check when a reload fails", async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(json({ success: true, data: AGREES }))
      .mockResolvedValueOnce(json({ success: false, error: "Reload failed" }, 500));
    vi.stubGlobal("fetch", fetchStub);

    const { rerender } = render(<CrawlBalanceSection reloadKey={1} />);
    expect(await screen.findByText(/in agreement/)).toBeTruthy();
    expect(screen.getByText("$0.3050 used this month")).toBeTruthy();

    rerender(<CrawlBalanceSection reloadKey={2} />);
    expect(await screen.findByText("Reload failed")).toBeTruthy();
    expect(screen.queryByText(/in agreement/)).toBeNull();
    expect(screen.queryByText("$0.3050 used this month")).toBeNull();
    expect(screen.queryByText("OpenRouter (LLM)")).toBeNull();
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});
