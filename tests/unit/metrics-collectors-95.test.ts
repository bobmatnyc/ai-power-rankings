/**
 * #95: the metrics collectors moved from scripts/ into lib/metrics-collectors/.
 *
 * Why: the collect-metrics cron route and the four CLIs share one class each, so
 *   both use the same matching heuristics. The move adds one thing, a per-fetch
 *   timeout that the route's run deadline can also abort.
 * What: stubs global fetch and checks that every collector fetch carries a signal
 *   that aborts on the per-fetch timeout and on the caller's signal; checks the
 *   CLIs import the shared class and keep exactly their one existing `tools`
 *   update, with no new one.
 * Test: `npx vitest run tests/unit/metrics-collectors-95.test.ts`. No network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FETCH_TIMEOUT_MS, fetchSignal } from "../../lib/metrics-collectors/fetch-signal";
import { GitHubMetricsCollector } from "../../lib/metrics-collectors/github";
import { NpmMetricsCollector } from "../../lib/metrics-collectors/npm";
import { PyPIMetricsCollector } from "../../lib/metrics-collectors/pypi";
import { VSCodeMarketplaceCollector } from "../../lib/metrics-collectors/vscode";

const ROOT = path.resolve(__dirname, "../..");

/** Stubs fetch with a 404 and records each call's signal. */
function stubFetch(): AbortSignal[] {
  const signals: AbortSignal[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return new Response("{}", { status: 404 });
    })
  );
  return signals;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("#95 fetchSignal", () => {
  it("uses a 10 s per-fetch timeout", () => {
    expect(FETCH_TIMEOUT_MS).toBe(10_000);
  });

  it("aborts with a TimeoutError when the per-fetch timeout passes", async () => {
    const signal = fetchSignal(undefined, 5);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(signal.aborted).toBe(true);
    expect((signal.reason as Error).name).toBe("TimeoutError");
  });

  it("aborts when the caller's signal aborts, before the timeout", () => {
    const controller = new AbortController();
    const signal = fetchSignal(controller.signal);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });
});

describe("#95 every collector fetch carries the joined signal", () => {
  const cases: Array<[string, (signal: AbortSignal) => Promise<unknown>]> = [
    ["npm package info", (s) => new NpmMetricsCollector({ signal: s }).getPackageInfo("pkg")],
    ["npm downloads", (s) => new NpmMetricsCollector({ signal: s }).getDownloadStats("pkg")],
    ["npm weekly", (s) => new NpmMetricsCollector({ signal: s }).getWeeklyDownloads("pkg")],
    ["npm search", (s) => new NpmMetricsCollector({ signal: s }).searchPackages("pkg")],
    ["pypi package info", (s) => new PyPIMetricsCollector({ signal: s }).getPackageInfo("pkg")],
    ["pypi downloads", (s) => new PyPIMetricsCollector({ signal: s }).getDownloadStats("pkg")],
    ["github token check", (s) => new GitHubMetricsCollector("t", { signal: s }).verifyToken()],
    ["github repo", (s) => new GitHubMetricsCollector("t", { signal: s }).collectMetrics("o", "r")],
    ["vscode search", (s) => new VSCodeMarketplaceCollector({ signal: s }).searchExtension("x")],
    ["vscode by id", (s) => new VSCodeMarketplaceCollector({ signal: s }).getExtensionById("a.b")],
  ];

  it.each(cases)("%s", async (_name, call) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const signals = stubFetch();
    const controller = new AbortController();

    await call(controller.signal);

    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) {
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    }
    controller.abort();
    for (const signal of signals) {
      expect(signal.aborted).toBe(true);
    }
  });

  it("a CLI-style collector with no caller signal still gets a timeout signal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const signals = stubFetch();
    await new NpmMetricsCollector().getPackageInfo("pkg");
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });
});

describe("#95 matching heuristics are unchanged", () => {
  it("a tool known to have no npm package makes no request", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const signals = stubFetch();
    await expect(new NpmMetricsCollector().findPackageForTool("Cursor", "cursor", {})).resolves.toBeNull();
    expect(signals).toHaveLength(0);
  });

  it("a known VS Code extension is looked up by its mapped id", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(String(init?.body));
        return new Response(JSON.stringify({ results: [{ extensions: [] }] }), { status: 200 });
      })
    );
    await new VSCodeMarketplaceCollector().findExtensionForTool("Cline", "cline", {});
    expect(bodies[0]).toContain("saoudrizwan.claude-dev");
  });
});

describe("#95 CLI scripts share the lib class and keep their writes", () => {
  const clis = {
    npm: "NpmMetricsCollector",
    pypi: "PyPIMetricsCollector",
    github: "GitHubMetricsCollector",
    vscode: "VSCodeMarketplaceCollector",
  };

  it.each(Object.entries(clis))("scripts/collect-%s-metrics.ts", (name, cls) => {
    const source = readFileSync(path.join(ROOT, `scripts/collect-${name}-metrics.ts`), "utf8");
    expect(source).toContain(`from "../lib/metrics-collectors/${name}"`);
    expect(source).not.toMatch(new RegExp(`class ${cls}\\b`));
    // The CLI's existing tools.data write stays, and no second one appears.
    expect(source.match(/\.update\(tools\)/g)).toHaveLength(1);
    expect(source).toMatch(
      new RegExp(`metrics: \\{\\s+\\.\\.\\.\\(currentData\\.metrics \\|\\| \\{\\}\\),\\s+${name}: metrics,`)
    );
  });

  it("the lib collectors never touch the database", () => {
    for (const name of Object.keys(clis)) {
      const source = readFileSync(path.join(ROOT, `lib/metrics-collectors/${name}.ts`), "utf8");
      expect(source).not.toMatch(/lib\/db|drizzle|getDb/);
    }
  });
});

describe("#95 GitHub rate-limit wait", () => {
  it("ends when the caller's signal aborts, instead of sleeping until the reset", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    stubFetch();
    const controller = new AbortController();
    const collector = new GitHubMetricsCollector("t", { signal: controller.signal });
    // Rate limit nearly spent, resetting in an hour.
    (collector as unknown as { rateLimit: { remaining: number; reset: number } }).rateLimit = {
      remaining: 0,
      reset: Math.ceil(Date.now() / 1000) + 3600,
    };

    const call = collector.collectMetrics("o", "r").then(() => "returned");
    setTimeout(() => controller.abort(), 20);
    const outcome = await Promise.race([call, new Promise((r) => setTimeout(() => r("still sleeping"), 1000))]);

    expect(outcome).toBe("returned");
  });
});
