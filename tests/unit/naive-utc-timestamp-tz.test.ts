/**
 * #103: the ingestion gap check gives the same answer under TZ=UTC and
 * TZ=America/New_York.
 *
 * Why: the 2026-10-23 cron run fired at 06:00:03 UTC, and a gap check in EDT reported it
 *   at 10:00:03 UTC. The driver's default `timestamp` parser reads the zone-less value
 *   in the process TZ. A process's zone is fixed at start, so each zone gets its own child.
 * What: Runs tests/unit/fixtures/naive-utc-tz-probe.mjs once per zone. The probe parses
 *   the wire text with the type parsers check-ingestion-gap.mjs hands neon() and feeds
 *   the result to evaluateIngestionRuns() and formatIngestedArticleLines(). The test
 *   asserts both zones print the same UTC instant and age.
 * Test: `npx vitest run tests/unit/naive-utc-timestamp-tz.test.ts`.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../..");
const PROBE = path.join(REPO_ROOT, "tests/unit/fixtures/naive-utc-tz-probe.mjs");

interface ProbeOutput {
  tz: string;
  driverLines: string[];
  textLines: string[];
  driverDetail: string[];
  textDetail: string[];
  migrateLiteral: string;
}

function probe(tz: string): ProbeOutput {
  const child = spawnSync(process.execPath, [PROBE], {
    cwd: REPO_ROOT,
    env: { ...process.env, TZ: tz },
    encoding: "utf8",
  });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as ProbeOutput;
}

const ZONES = ["UTC", "America/New_York"] as const;

const EXPECTED_VERDICT = [
  "OK: last ingestion run 11.0h ago (2026-10-23T06:00:03.123Z), status='completed', 2 articles ingested",
  "LAST_STATUS=completed",
  "LAST_RUN_STARTED=2026-10-23T06:00:03.123Z",
];
const EXPECTED_DETAIL = [
  "INGESTED_ARTICLE_IDS=1",
  "INGESTED_ARTICLE id=a1 slug=s status=active published_date=2026-10-23T06:00:03.123Z created_at=2026-10-23T06:00:03.123Z",
];

describe("check-ingestion-gap under two process time zones", () => {
  const outputs = Object.fromEntries(ZONES.map((tz) => [tz, probe(tz)])) as Record<
    (typeof ZONES)[number],
    ProbeOutput
  >;

  it.each(ZONES)("runs the probe in %s", (tz) => {
    expect(outputs[tz].tz).toBe(tz);
  });

  it.each(ZONES)("%s: driver-parsed started_at gives the UTC instant and an 11.0h age", (tz) => {
    expect(outputs[tz].driverLines).toEqual(EXPECTED_VERDICT);
    expect(outputs[tz].driverDetail).toEqual(EXPECTED_DETAIL);
  });

  it.each(ZONES)("%s: zone-less text started_at gives the same result", (tz) => {
    expect(outputs[tz].textLines).toEqual(EXPECTED_VERDICT);
    expect(outputs[tz].textDetail).toEqual(EXPECTED_DETAIL);
  });

  // #103: migrate-v76-to-articles-simple.ts writes the instant it read, in any zone.
  it.each(ZONES)("%s: the migrate script's published_date literal is the UTC instant", (tz) => {
    expect(outputs[tz].migrateLiteral).toBe("'2025-11-03T00:00:00.000Z'");
  });

  it("prints identical verdict and detail lines in both zones", () => {
    const { tz: _utc, ...utc } = outputs.UTC;
    const { tz: _ny, ...ny } = outputs["America/New_York"];
    expect(ny).toEqual(utc);
  });
});
