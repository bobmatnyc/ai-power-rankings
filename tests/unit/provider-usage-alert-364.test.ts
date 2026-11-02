/**
 * #364: a failed ledger write raises an alert, and the caller still gets its result.
 *
 * Why: in production the ledger table was missing; every model call dropped its usage
 *   row with only a warn-level log and no alert, so the spend ledger stayed empty.
 * What: an insert that throws (the missing-table error) must log "ledger row not
 *   written" at error level and POST one alert to ALERT_WEBHOOK_URL, and
 *   `recordOpenRouterUsage` must still resolve false without throwing. Further
 *   failures inside LEDGER_ALERT_INTERVAL_MS log but do not alert again; a failing
 *   webhook never throws. The full-run case (run outcome unchanged while alerting) is
 *   in `tests/unit/provider-usage-fail-open-325.test.ts`.
 * Test: `npx vitest run tests/unit/provider-usage-alert-364.test.ts`. No network, no
 *   database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ledger = vi.hoisted(() => ({ mode: "throw" as "ok" | "throw" }));

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    insert: () => ({
      values: async () => {
        if (ledger.mode === "throw") throw new Error('relation "provider_usage_events" does not exist');
      },
    }),
  }),
}));

import { loggers } from "../../lib/logger";
import {
  LEDGER_ALERT_INTERVAL_MS,
  LEDGER_ALERT_TEXT,
  LEDGER_NOT_WRITTEN_MSG,
  recordOpenRouterUsage,
  resetLedgerAlertThrottle,
} from "../../lib/services/provider-usage";

const WEBHOOK = "https://hooks.example.com/alerts";
const BODY = { usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.001 } };

function record() {
  return recordOpenRouterUsage({ operation: "article_quality", model: "m", body: BODY });
}

let fetchStub: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  ledger.mode = "throw";
  resetLedgerAlertThrottle();
  vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK);
  fetchStub = vi.fn(async () => new Response("ok", { status: 200 }));
  vi.stubGlobal("fetch", fetchStub);
  errorLog = vi.spyOn(loggers.api, "error");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function alertPayloads(): Array<Record<string, unknown>> {
  return fetchStub.mock.calls
    .filter(([url]) => url === WEBHOOK)
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>);
}

describe("#364 ledger write failure alerts", () => {
  it("a failed insert logs at error level and posts one webhook alert; the call still resolves", async () => {
    await expect(record()).resolves.toBe(false);

    expect(errorLog).toHaveBeenCalledWith(
      LEDGER_NOT_WRITTEN_MSG,
      expect.objectContaining({
        provider: "openrouter",
        operation: "article_quality",
        error: expect.stringContaining("provider_usage_events"),
      })
    );
    const payloads = alertPayloads();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      text: LEDGER_ALERT_TEXT,
      provider: "openrouter",
      operation: "article_quality",
      error: expect.stringContaining("provider_usage_events"),
    });
  });

  it("a working insert neither logs an error nor alerts", async () => {
    ledger.mode = "ok";
    await expect(record()).resolves.toBe(true);
    expect(errorLog).not.toHaveBeenCalled();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("repeat failures inside the interval log each row but alert once; after it, alert again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await record();
    await record();
    await record();
    expect(errorLog.mock.calls.filter(([m]) => m === LEDGER_NOT_WRITTEN_MSG)).toHaveLength(3);
    expect(alertPayloads()).toHaveLength(1);

    vi.setSystemTime(Date.now() + LEDGER_ALERT_INTERVAL_MS);
    await record();
    expect(alertPayloads()).toHaveLength(2);
  });

  it("a webhook that rejects or answers 500 never throws into the caller", async () => {
    fetchStub.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(record()).resolves.toBe(false);

    resetLedgerAlertThrottle();
    fetchStub.mockResolvedValueOnce(new Response("no", { status: 500 }));
    await expect(record()).resolves.toBe(false);

    expect(errorLog).toHaveBeenCalledWith(
      "[ProviderUsage] ledger failure alert not sent",
      expect.objectContaining({ error: expect.stringContaining("500") })
    );
  });

  it("with no webhook configured the failure still logs at error level", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "");
    await expect(record()).resolves.toBe(false);
    expect(fetchStub).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(LEDGER_NOT_WRITTEN_MSG, expect.any(Object));
  });
});
