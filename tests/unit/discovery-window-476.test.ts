/**
 * Daily provider window is 7 days (#476).
 *
 * Why: a 3-day window starved on-topic supply after #482.
 * What: Pins the constant to 7 and checks the daily-news route passes that
 * constant as `days` (the runtime value is asserted in
 * cron-daily-news-window-476.test.ts).
 * Test: `npx vitest run tests/unit/discovery-window-476.test.ts`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DAILY_PROVIDER_WINDOW_DAYS } from "../../lib/services/discovery-queries";

describe("daily provider window (#476)", () => {
  it("is 7 days", () => {
    expect(DAILY_PROVIDER_WINDOW_DAYS).toBe(7);
  });

  it("is the value the daily-news route passes as `days`", () => {
    const route = readFileSync(resolve(__dirname, "../../app/api/cron/daily-news/route.ts"), "utf8");
    expect(route).toMatch(/days:\s*DAILY_PROVIDER_WINDOW_DAYS/);
  });
});
