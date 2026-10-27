/**
 * GET /api/cron/weekly-digest: auth gate, outcomes, alerts and schedule (#181).
 *
 * Why: the route spends an LLM call and writes a published digest, so an
 * unauthorised request must cost nothing, a failure must alert and fail without
 * hiding behind a 200, and a quiet week (nothing to write) must not alert.
 * What: drives the real GET handler with the generate service replaced by a
 * spy, so the assertions are about the route: the bearer check comes first, query
 * flags reach the service, each outcome maps to a status, and a failure posts one
 * webhook alert. A last case reads vercel.json for the Monday 07:30 UTC entry.
 * Test: `npx vitest run tests/unit/cron-weekly-digest-181.test.ts`. No network,
 * no database.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock("../../lib/services/weekly-digest.service", () => ({
  generateWeeklyDigest: mocks.generate,
}));

import { GET, maxDuration } from "../../app/api/cron/weekly-digest/route";

const SECRET = "cron-secret-fixture-value";
const URL_BASE = "https://aipowerranking.com/api/cron/weekly-digest";
const originalSecret = process.env["CRON_SECRET"];
const originalWebhook = process.env["ALERT_WEBHOOK_URL"];

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function request(auth?: string, query = ""): Request {
  const headers = new Headers();
  if (auth !== undefined) headers.set("authorization", auth);
  return new Request(`${URL_BASE}${query}`, { method: "GET", headers });
}

const authed = (query = "") => request(`Bearer ${SECRET}`, query);
const alertFetch = vi.fn(async () => new Response("ok"));

beforeEach(() => {
  mocks.generate.mockReset();
  alertFetch.mockClear();
  vi.stubGlobal("fetch", alertFetch);
  process.env["CRON_SECRET"] = SECRET;
  process.env["ALERT_WEBHOOK_URL"] = "https://alerts.example.test/hook";
});

afterEach(() => {
  vi.unstubAllGlobals();
  restoreEnv("CRON_SECRET", originalSecret);
  restoreEnv("ALERT_WEBHOOK_URL", originalWebhook);
});

describe("GET /api/cron/weekly-digest auth (#181)", () => {
  it.each([
    ["no Authorization header", undefined],
    ["a wrong bearer token", "Bearer not-the-cron-secret"],
  ])("returns 401 and never generates for %s", async (_name, header) => {
    const response = await GET(request(header));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, error: "Unauthorized" });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each([
    { secret: undefined, header: "Bearer undefined" },
    { secret: "", header: "Bearer" },
  ])("returns 401 for '$header' when CRON_SECRET is unset or empty", async ({ secret, header }) => {
    restoreEnv("CRON_SECRET", secret);
    const response = await GET(request(header));
    expect(response.status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("alerts on a 401, as the sibling routes do", async () => {
    await GET(request("Bearer wrong"));
    expect(alertFetch).toHaveBeenCalledTimes(1);
    expect(String(alertFetch.mock.calls[0]?.[0])).toBe("https://alerts.example.test/hook");
  });
});

describe("GET /api/cron/weekly-digest outcomes (#181)", () => {
  it("generates with no flags by default and answers 200 with the outcome", async () => {
    mocks.generate.mockResolvedValue({ status: "generated", week: "2026-W43", tier: "full" });
    const response = await GET(authed());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, status: "generated", week: "2026-W43" });
    expect(mocks.generate).toHaveBeenCalledWith({ force: false, dryRun: false });
    expect(alertFetch).not.toHaveBeenCalled();
  });

  it("passes force and dry_run through to the service", async () => {
    mocks.generate.mockResolvedValue({ status: "dry-run", week: "2026-W43" });
    await GET(authed("?force=1&dry_run=1"));
    expect(mocks.generate).toHaveBeenCalledWith({ force: true, dryRun: true });
  });

  it.each(["no-articles", "already-stored"])("answers 200 and does not alert for a skip: %s", async (reason) => {
    mocks.generate.mockResolvedValue({ status: "skipped", week: "2026-W43", reason });
    const response = await GET(authed());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, status: "skipped", reason });
    expect(alertFetch).not.toHaveBeenCalled();
  });

  it("answers 500 and posts one alert when generation fails", async () => {
    mocks.generate.mockRejectedValue(new Error("OpenRouter API error (502): upstream"));
    const response = await GET(authed());
    expect(response.status).toBe(500);
    const body = (await response.json()) as { success: boolean; details: string };
    expect(body.success).toBe(false);
    expect(body.details).toContain("OpenRouter API error (502)");
    expect(alertFetch).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String((alertFetch.mock.calls[0]?.[1] as RequestInit).body)) as { text: string };
    expect(sent.text).toContain("/api/cron/weekly-digest");
  });
});

describe("weekly digest schedule (#181)", () => {
  it("has one vercel.json cron at Monday 07:30 UTC and a 300 s function limit", () => {
    const vercel = JSON.parse(readFileSync(path.resolve(__dirname, "../../vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const entries = vercel.crons.filter((c) => c.path === "/api/cron/weekly-digest");
    expect(entries).toEqual([{ path: "/api/cron/weekly-digest", schedule: "30 7 * * 1" }]);
    expect(maxDuration).toBe(300);
  });
});
