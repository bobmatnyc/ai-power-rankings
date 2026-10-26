/**
 * #184: the Hugging Face Hub model collector, including every error arm.
 *
 * Why: a failed Hub call must never turn into a metric. Each failure arm below throws (or,
 *   for 404, returns null) and so can never reach the history store as a value.
 * What: drives `HuggingFaceModelCollector` with a stub `fetch` (no network). One table covers
 *   the throwing arms; separate cases cover the leaves, the benchmark rules and the 404.
 * Test: `npx vitest run tests/unit/metrics-huggingface-184.test.ts`. No server, no network.
 */

import { describe, expect, it } from "vitest";
import { HuggingFaceModelCollector, isValidRepoId } from "../../lib/metrics-collectors/huggingface";

const NOW = new Date("2026-11-01T00:00:00.000Z");

function collector(impl: (url: string) => Promise<Response>) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return impl(String(input));
  }) as typeof fetch;
  return { calls, collector: new HuggingFaceModelCollector({ fetchImpl, now: () => NOW }) };
}

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const GOOD = {
  downloads: 1200,
  likes: 34,
  lastModified: "2026-09-01T00:00:00.000Z",
  gated: false,
  cardData: { license: "apache-2.0" },
  safetensors: { total: 20_914_757_184 },
  evalResults: [],
};

describe("#184 HuggingFaceModelCollector leaves", () => {
  it("returns one leaf per field with source and as_of, and asks the Hub for the expanded fields", async () => {
    const { collector: c, calls } = collector(() => json(GOOD));
    const leaves = await c.fetchModelMetrics("acme/model-a");
    expect(leaves).toMatchObject({
      downloads_30d: { value: 1200, source: "huggingface-hub-api", as_of: NOW.toISOString() },
      likes: { value: 34 },
      license: { value: "apache-2.0" },
      parameters_total: { value: 20_914_757_184 },
      last_modified: { value: "2026-09-01T00:00:00.000Z" },
      gated: { value: false },
    });
    expect(calls[0]).toContain("https://huggingface.co/api/models/acme/model-a?");
    expect(calls[0]).toContain("expand[]=evalResults");
  });

  it("omits a field the Hub does not return instead of defaulting it", async () => {
    const { collector: c } = collector(() => json({ downloads: 5, likes: 0 }));
    const leaves = await c.fetchModelMetrics("acme/model-a");
    expect(Object.keys(leaves ?? {}).sort()).toEqual(["downloads_30d", "likes"]);
    // A real zero is recorded as zero: likes is present in the response.
    expect(leaves?.["likes"]?.value).toBe(0);
  });

  it("keeps the newest result per dataset and task, flags unverified and non-numeric ones, keeps the origin", async () => {
    const evalResults = [
      { verified: false, data: { dataset: { id: "org/bench", task_id: "t1" }, value: 10, date: "2026-01-01", source: { url: "https://example.test/a", name: "A" } } },
      { verified: false, data: { dataset: { id: "org/bench", task_id: "t1" }, value: 12, date: "2026-03-01", source: { url: "https://example.test/b", name: "B" } } },
      { verified: true, data: { dataset: { id: "org/other" }, value: 55.5, date: "2026-02-01" } },
      { verified: true, data: { dataset: { id: "org/text" }, value: "n/a", date: "2026-02-01" } },
      { data: { dataset: {}, value: 1 } },
    ];
    const { collector: c } = collector(() => json({ ...GOOD, evalResults }));
    const leaves = (await c.fetchModelMetrics("acme/model-a")) ?? {};
    expect(leaves["benchmark:org/bench:t1"]).toMatchObject({
      value: 12,
      flags: ["unverified"],
      origin: { url: "https://example.test/b", name: "B", date: "2026-03-01" },
    });
    expect(leaves["benchmark:org/other:default"]).toMatchObject({ value: 55.5 });
    expect(leaves["benchmark:org/other:default"]?.flags).toBeUndefined();
    expect(leaves["benchmark:org/text:default"]?.flags).toEqual(["non_numeric"]);
    expect(Object.keys(leaves).filter((k) => k.startsWith("benchmark:"))).toHaveLength(3);
  });
});

describe("#184 HuggingFaceModelCollector error arms (each must throw, never return metrics)", () => {
  it("returns null for a 404 and nothing else", async () => {
    const { collector: c } = collector(() => json({ error: "gone" }, 404));
    await expect(c.fetchModelMetrics("acme/model-a")).resolves.toBeNull();
  });

  it.each([
    ["401", () => json({ error: "auth" }, 401), /HTTP 401/],
    ["403", () => json({ error: "no" }, 403), /HTTP 403/],
    ["429", () => json({ error: "slow down" }, 429), /HTTP 429/],
    ["500", () => json({ error: "boom" }, 500), /HTTP 500/],
    ["network error", () => Promise.reject(new TypeError("fetch failed")), /fetch failed/],
    ["body not JSON", () => Promise.resolve(new Response("<html>", { status: 200 })), /not JSON/],
    ["body not an object", () => json([1, 2]), /unexpected body shape/],
    ["downloads missing", () => json({ likes: 3 }), /no usable downloads/],
    ["likes not a number", () => json({ downloads: 3, likes: "many" }), /no usable likes/],
    ["downloads negative", () => json({ downloads: -1, likes: 3 }), /no usable downloads/],
  ])("throws on %s", async (_name, impl, message) => {
    const { collector: c } = collector(impl as () => Promise<Response>);
    await expect(c.fetchModelMetrics("acme/model-a")).rejects.toThrow(message as RegExp);
  });

  it("rejects a malformed repo id before any request", async () => {
    const { collector: c, calls } = collector(() => json(GOOD));
    await expect(c.fetchModelMetrics("../etc/passwd")).rejects.toThrow(/invalid Hugging Face repo id/);
    await expect(c.fetchModelMetrics("acme/model?x=1")).rejects.toThrow(/invalid Hugging Face repo id/);
    expect(calls).toHaveLength(0);
    expect(isValidRepoId("openai/gpt-oss-20b")).toBe(true);
  });
});
