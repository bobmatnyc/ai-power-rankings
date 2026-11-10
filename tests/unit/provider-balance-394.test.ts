/**
 * Provider balance cross-check (#394).
 *
 * Why: the cross-check sets each provider's own figure next to the ledger. It must
 *   stay admin-only and uncached, expose no key, and never show a failed or
 *   missing balance read as $0 or as "in agreement".
 * What: the route runs through the real `requireAdmin()` (Clerk's `auth` and
 *   `currentUser` replaced, as in `crawl-spend-393.test.ts`); the ledger read is
 *   replaced by synthetic day rows shaped by the real `summarizeProviderSpend`;
 *   `fetch` is a stub that answers per URL and throws on any other, so no test
 *   reaches the network. Keys are synthetic.
 * Test: `npx vitest run tests/unit/provider-balance-394.test.ts`.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
const holder = vi.hoisted(() => ({ getDbCalls: 0, ledger: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("../../lib/db/connection", () => ({
  getDb: () => {
    holder.getDbCalls += 1;
    return {};
  },
}));
vi.mock("../../lib/crawl-monitor/queries", () => ({ loadCrawlSpend: holder.ledger }));

import * as balancesRoute from "../../app/api/admin/crawl-monitor/balances/route";
import {
  type BalanceRead,
  type RecordedSpend,
  agreementText,
  balanceText,
  compareBalance,
  readProviderBalances,
  remainingText,
} from "../../lib/crawl-monitor/balances";
import { type SpendDayRow, summarizeProviderSpend } from "../../lib/crawl-monitor/spend";

const ANONYMOUS = [{ userId: null }, null] as const;
const NON_ADMIN = [{ userId: "user_1" }, { id: "user_1", privateMetadata: {} }] as const;
const ADMIN = [{ userId: "user_1" }, { id: "user_1", privateMetadata: { isAdmin: true } }] as const;

function signIn([session, user]: readonly [unknown, unknown]) {
  clerk.auth.mockResolvedValue(session);
  clerk.currentUser.mockResolvedValue(user);
}

const NOW = new Date("2030-03-15T12:00:00Z");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/key";
const TAVILY_URL = "https://api.tavily.com/usage";

// Synthetic values only.
const KEYS = {
  OPENROUTER_API_KEY: "synthetic-or-value-3333",
  TAVILY_API_KEY: "synthetic-tv-value-1111",
  JINA_API_KEY: "synthetic-jn-value-2222",
  BRAVE_SEARCH_API_KEY: "synthetic-br-value-4444",
};

const day = (provider: string, d: string, calls: number, priced: number, cost: string | null, units: string | null = null): SpendDayRow => ({
  provider,
  day: d,
  calls: String(calls),
  pricedCalls: String(priced),
  reportedCalls: "0",
  costUsd: cost,
  units,
});

// This month: OpenRouter $0.30 over two calls; Tavily 4 credits.
const LEDGER_ROWS: SpendDayRow[] = [
  day("openrouter", "2030-03-15", 1, 1, "0.100000"),
  day("openrouter", "2030-03-02", 1, 1, "0.200000"),
  day("tavily", "2030-03-10", 3, 3, "0.024300", "4.0000"),
];

/** Provider bodies as documented, including the identifying fields that must be dropped. */
const OPENROUTER_BODY = {
  data: {
    label: "sk-or-v1-syn...999",
    creator_user_id: "user_synthetic_creator",
    organization_id: "org_synthetic",
    usage: 12.5,
    usage_daily: 0.1,
    usage_monthly: 0.305,
    limit: 50,
    limit_remaining: 37.5,
  },
};
const TAVILY_BODY = {
  key: { usage: 150, limit: null },
  account: { current_plan: "Synthetic Plan", plan_usage: 500, plan_limit: 15000 },
};

type Responder = (init: RequestInit) => Promise<Response> | Response;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A fetch stub that answers only the URLs given and fails the test on any other. */
function stubFetch(routes: Record<string, Responder>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const responder = routes[url];
    if (!responder) throw new Error(`unexpected network call in test: ${url}`);
    return responder(init);
  });
  return { impl, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_stub");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_stub");
  vi.stubEnv("DATABASE_URL", "postgresql://u:pw@db.example.test/stubdb");
  for (const [name, value] of Object.entries(KEYS)) vi.stubEnv(name, value);
  holder.getDbCalls = 0;
  holder.ledger.mockImplementation(async (_db: unknown, now: Date) =>
    summarizeProviderSpend(LEDGER_ROWS, now, { openrouter: true, tavily: true, jina: false, brave: false })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type View = { provider: string; balance: BalanceRead; recorded: RecordedSpend | null; agreement: { status: string; reason?: string; difference?: number } };

async function adminBalances(routes: Record<string, Responder>) {
  const fetchStub = stubFetch(routes);
  vi.stubGlobal("fetch", fetchStub.impl);
  signIn(ADMIN);
  const res = await balancesRoute.GET();
  const body = await res.json();
  const by = (name: string) => (body.data.providers as View[]).find((p) => p.provider === name)!;
  return { res, body, by, fetchStub };
}

const HAPPY = { [OPENROUTER_URL]: () => json(OPENROUTER_BODY), [TAVILY_URL]: () => json(TAVILY_BODY) };

describe("GET /api/admin/crawl-monitor/balances auth and caching", () => {
  it.each([
    ["anonymous", ANONYMOUS, 401],
    ["signed-in non-admin", NON_ADMIN, 403],
  ] as const)("refuses a %s caller with no-store, before any DB read or provider call", async (_name, who, status) => {
    const fetchStub = stubFetch(HAPPY);
    vi.stubGlobal("fetch", fetchStub.impl);
    signIn(who);
    const res = await balancesRoute.GET();
    expect(res.status).toBe(status);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(holder.getDbCalls).toBe(0);
    expect(fetchStub.calls).toHaveLength(0);
  });

  it("answers an admin with no-store, and the route is dynamic", async () => {
    const { res, body } = await adminBalances(HAPPY);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body.success).toBe(true);
    expect(balancesRoute.dynamic).toBe("force-dynamic");
  });

  it("names no key, env variable, account id, provider label or DB detail", async () => {
    const { body } = await adminBalances(HAPPY);
    const text = JSON.stringify(body);
    for (const leak of [
      ...Object.values(KEYS),
      "API_KEY",
      "sk-or-v1",
      "user_synthetic_creator",
      "org_synthetic",
      "Synthetic Plan",
      "provider_usage_events",
      "example.test",
      "stubdb",
      "postgresql",
    ]) {
      expect(text).not.toContain(leak);
    }
  });
});

describe("cross-check with every read succeeding", () => {
  it("compares OpenRouter's UTC-month USD with the ledger month", async () => {
    const { by } = await adminBalances(HAPPY);
    expect(by("openrouter").balance).toEqual({
      state: "ok",
      reported: { unit: "usd", period: "utc_month", used: 0.305, remaining: 37.5 },
    });
    expect(by("openrouter").recorded).toMatchObject({ calls: 2, unpricedCalls: 0, costUsd: 0.3 });
    expect(by("openrouter").agreement).toEqual({ status: "agrees", difference: 0.005 });
  });

  it("shows Tavily's billing-cycle credits next to the ledger but does not compare them", async () => {
    const { by } = await adminBalances(HAPPY);
    expect(by("tavily").balance).toEqual({
      state: "ok",
      reported: { unit: "credits", period: "billing_cycle", used: 150, remaining: 14500 },
    });
    expect(by("tavily").recorded).toMatchObject({ units: 4 });
    expect(by("tavily").agreement).toEqual({ status: "not_compared", reason: "billing cycle dates not reported" });
  });

  it("calls only the two balance APIs, once each, with GET and a bearer key", async () => {
    const { fetchStub, by } = await adminBalances(HAPPY);
    expect(fetchStub.calls.map((c) => c.url).sort()).toEqual([TAVILY_URL, OPENROUTER_URL].sort());
    for (const c of fetchStub.calls) {
      expect(c.init.method).toBe("GET");
      expect(c.init.cache).toBe("no-store");
      expect(c.init.signal).toBeInstanceOf(AbortSignal);
    }
    expect(fetchStub.calls.find((c) => c.url === OPENROUTER_URL)!.init.headers).toMatchObject({
      Authorization: `Bearer ${KEYS.OPENROUTER_API_KEY}`,
    });
    expect(by("jina").balance).toEqual({ state: "no_api" });
    expect(by("brave").balance).toEqual({ state: "no_api" });
  });

  it("reports a gap beyond tolerance as differs", async () => {
    const { by } = await adminBalances({
      ...HAPPY,
      [OPENROUTER_URL]: () => json({ data: { ...OPENROUTER_BODY.data, usage_monthly: 1.3 } }),
    });
    expect(by("openrouter").agreement).toEqual({ status: "differs", difference: 1 });
  });
});

describe("a balance that cannot be read is never zero and never in agreement", () => {
  // The ledger has no OpenRouter call this month, so a failed read mistaken for $0 would "agree".
  beforeEach(() => {
    holder.ledger.mockImplementation(async (_db: unknown, now: Date) => summarizeProviderSpend([], now, {}));
  });

  const abortable = (init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    });

  it.each([
    ["key rejected (401)", () => json({ error: "Invalid key synthetic-or-value-3333" }, 401), "unauthenticated"],
    ["forbidden (403)", () => json({}, 403), "unauthenticated"],
    ["provider error (500)", () => json({ error: "boom" }, 500), "http_error"],
    ["network failure", () => Promise.reject(new TypeError("fetch failed")), "network_error"],
    ["non-JSON body", () => new Response("<html>", { status: 200 }), "bad_response"],
    ["usage field missing", () => json({ data: { limit_remaining: 10 } }), "bad_response"],
    ["usage field null", () => json({ data: { usage_monthly: null } }), "bad_response"],
    ["usage field a string", () => json({ data: { usage_monthly: "0" } }), "bad_response"],
    ["negative usage", () => json({ data: { usage_monthly: -1 } }), "bad_response"],
  ] as const)("%s reads as unavailable and is not compared", async (_name, responder, reason) => {
    const { by, body, fetchStub } = await adminBalances({ ...HAPPY, [OPENROUTER_URL]: responder });
    const view = by("openrouter");
    expect(view.balance).toEqual({ state: "unavailable", reason });
    expect(view.recorded).toMatchObject({ calls: 0, costUsd: null });
    expect(view.agreement).toEqual({ status: "not_compared", reason: "balance unavailable" });
    expect(balanceText(view.balance)).toMatch(/^unavailable/);
    expect(balanceText(view.balance)).not.toContain("$");
    expect(agreementText(view.agreement as never)).not.toMatch(/agree/);
    expect(remainingText(view.balance)).toBe("");
    // One attempt, no retry; the provider's error body never reaches the response.
    expect(fetchStub.calls.filter((c) => c.url === OPENROUTER_URL)).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("synthetic-or-value");
  });

  it("a read that never answers times out after the bound, once, as unavailable", async () => {
    const fetchStub = stubFetch({ [OPENROUTER_URL]: abortable, [TAVILY_URL]: abortable });
    const t0 = performance.now();
    const reads = await readProviderBalances({ OPENROUTER_API_KEY: "k", TAVILY_API_KEY: "k" } as NodeJS.ProcessEnv, fetchStub.impl, 25);
    expect(performance.now() - t0).toBeLessThan(2_000);
    expect(reads.openrouter).toEqual({ state: "unavailable", reason: "timeout" });
    expect(reads.tavily).toEqual({ state: "unavailable", reason: "timeout" });
    expect(fetchStub.calls).toHaveLength(2);
  });

  it("a provider with no key is not configured, gets no request and is not compared", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "  ");
    const { by, fetchStub } = await adminBalances(HAPPY);
    expect(by("openrouter").balance).toEqual({ state: "not_configured" });
    expect(by("openrouter").agreement).toEqual({ status: "not_compared", reason: "key not configured" });
    expect(balanceText(by("openrouter").balance)).toBe("not configured");
    expect(fetchStub.calls.map((c) => c.url)).toEqual([TAVILY_URL]);
  });

  it("a failed ledger read is reported as ledger unavailable, not as $0 recorded", async () => {
    holder.ledger.mockRejectedValue(new Error('relation "provider_usage_events" does not exist at db.example.test'));
    const { res, body, by } = await adminBalances(HAPPY);
    expect(res.status).toBe(200);
    expect(body.data.ledgerAvailable).toBe(false);
    expect(by("openrouter").recorded).toBeNull();
    expect(by("openrouter").agreement).toEqual({ status: "not_compared", reason: "ledger unavailable" });
    expect(JSON.stringify(body)).not.toContain("provider_usage_events");
  });
});

describe("compareBalance", () => {
  const ok = (used: number): BalanceRead => ({ state: "ok", reported: { unit: "usd", period: "utc_month", used, remaining: null } });
  const rec = (r: Partial<RecordedSpend>): RecordedSpend => ({ calls: 1, unpricedCalls: 0, costUsd: 0.5, units: null, unitLabel: "tokens", ...r });

  it("does not compare a month with unpriced ledger calls", () => {
    expect(compareBalance(ok(0.5), rec({ calls: 3, unpricedCalls: 2 }))).toEqual({
      status: "not_compared",
      reason: "2 ledger calls not priced",
    });
  });

  it("treats a month with no ledger calls as $0 recorded only when the provider read succeeded", () => {
    expect(compareBalance(ok(0), rec({ calls: 0, costUsd: null }))).toEqual({ status: "agrees", difference: 0 });
    expect(compareBalance({ state: "unavailable", reason: "timeout" }, rec({ calls: 0, costUsd: null })).status).toBe("not_compared");
  });

  it("the section issues GET requests only, to the admin route", () => {
    const src = readFileSync("app/[lang]/(authenticated)/admin/crawl-monitor/crawl-balance-section.tsx", "utf8");
    expect(src).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)/i);
    expect(src).toContain('"/api/admin/crawl-monitor/balances"');
  });
});
