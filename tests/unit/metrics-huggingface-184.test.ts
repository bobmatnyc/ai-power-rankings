/**
 * #184: the Hugging Face Hub model collector, including every error arm.
 *
 * Why: a failed Hub call must never turn into a metric. Each failure arm throws (or, for 404,
 *   returns null) and so can never reach the history store as a value.
 * What: drives `HuggingFaceModelCollector` with a stub `fetch` (no network, no token).
 * Test: `npx vitest run tests/unit/metrics-huggingface-184.test.ts`
 */

import { describe, expect, it } from "vitest";
import { HuggingFaceModelCollector, isValidRepoId } from "../../lib/metrics-collectors/huggingface";

const NOW = new Date("2026-11-01T00:00:00.000Z");
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

function setup(impl: () => Promise<Response>, token?: string) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
    return impl();
  }) as typeof fetch;
  return { calls, collector: new HuggingFaceModelCollector({ fetchImpl, now: () => NOW, token }) };
}

describe("#184 HuggingFaceModelCollector leaves", () => {
  it("returns downloads and likes with the API URL as source and as_of", async () => {
    const { collector, calls } = setup(() => json({ downloads: 1200, likes: 34 }));
    const leaves = await collector.fetchModelMetrics("acme/model-a");
    const source = "https://huggingface.co/api/models/acme/model-a";
    expect(leaves).toEqual({
      downloads_30d: { value: 1200, source, as_of: NOW.toISOString() },
      likes: { value: 34, source, as_of: NOW.toISOString() },
    });
    expect(calls[0]?.url).toBe(`${source}?expand[]=downloads&expand[]=likes`);
  });

  it("records a real zero as zero", async () => {
    const { collector } = setup(() => json({ downloads: 0, likes: 0 }));
    expect((await collector.fetchModelMetrics("acme/model-a"))?.["likes"]?.value).toBe(0);
  });

  it("sends no Authorization header without a token and a bearer header with one", async () => {
    const anon = setup(() => json({ downloads: 1, likes: 1 }));
    await anon.collector.fetchModelMetrics("acme/model-a");
    expect(anon.calls[0]?.headers["Authorization"]).toBeUndefined();
    const authed = setup(() => json({ downloads: 1, likes: 1 }), "stub-token");
    await authed.collector.fetchModelMetrics("acme/model-a");
    expect(authed.calls[0]?.headers["Authorization"]).toBe("Bearer stub-token");
    const empty = setup(() => json({ downloads: 1, likes: 1 }), "");
    await empty.collector.fetchModelMetrics("acme/model-a");
    expect(empty.calls[0]?.headers["Authorization"]).toBeUndefined();
  });
});

describe("#184 HuggingFaceModelCollector error arms (each must throw, never return metrics)", () => {
  it("returns null for a 404 and nothing else", async () => {
    const { collector } = setup(() => json({ error: "gone" }, 404));
    await expect(collector.fetchModelMetrics("acme/model-a")).resolves.toBeNull();
  });

  it.each([
    ["401", () => json({ error: "auth" }, 401), /HTTP 401/],
    ["403", () => json({ error: "no" }, 403), /HTTP 403/],
    ["429", () => json({ error: "slow down" }, 429), /HTTP 429/],
    ["500", () => json({ error: "boom" }, 500), /HTTP 500/],
    ["network error", () => Promise.reject(new TypeError("fetch failed")), /fetch failed/],
    ["timeout", () => Promise.reject(new DOMException("The operation timed out", "TimeoutError")), /timed out/],
    ["body not JSON", () => Promise.resolve(new Response("<html>", { status: 200 })), /not JSON/],
    ["body not an object", () => json([1, 2]), /unexpected body shape/],
    ["downloads missing", () => json({ likes: 3 }), /no usable downloads/],
    ["likes not a number", () => json({ downloads: 3, likes: "many" }), /no usable likes/],
    ["downloads negative", () => json({ downloads: -1, likes: 3 }), /no usable downloads/],
  ])("throws on %s", async (_name, impl, message) => {
    const { collector } = setup(impl as () => Promise<Response>);
    await expect(collector.fetchModelMetrics("acme/model-a")).rejects.toThrow(message as RegExp);
  });

  it("rejects a malformed repo id before any request", async () => {
    const { collector, calls } = setup(() => json({ downloads: 1, likes: 1 }));
    await expect(collector.fetchModelMetrics("../etc/passwd")).rejects.toThrow(/invalid Hugging Face repo id/);
    await expect(collector.fetchModelMetrics("acme/model?x=1")).rejects.toThrow(/invalid Hugging Face repo id/);
    expect(calls).toHaveLength(0);
    expect(isValidRepoId("openai/gpt-oss-20b")).toBe(true);
  });
});
