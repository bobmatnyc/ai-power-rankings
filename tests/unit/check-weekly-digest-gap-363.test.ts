/**
 * The cron gap detector watches the weekly-digest cron (#363).
 *
 * Why: the weekly-digest cron writes no automated_ingestion_runs row, so a missed or failed
 * Monday run was invisible to the daily gap detector.
 * What: evaluateWeeklyDigest() alerts on an empty table, on a newest digest older than
 * MAX_DIGEST_AGE_HOURS and on an unreadable generated_at, and passes a digest inside the
 * limit; cron-gap-detector.yml runs the script in its own job with DATABASE_URL and
 * nothing that swallows its exit code.
 * Test: `npx vitest run tests/unit/check-weekly-digest-gap-363.test.ts`. No database.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_DIGEST_AGE_HOURS, evaluateWeeklyDigest } from "../../scripts/check-weekly-digest-gap.mjs";

const HOUR = 60 * 60 * 1000;
// Tuesday 09:00 UTC, the detector's first run after a Monday 07:30 UTC digest slot.
const NOW = new Date("2026-11-03T09:00:00.000Z").getTime();

function digestAt(hoursAgo: number, week = "2026-W44") {
  return { week, generated_at: new Date(NOW - hoursAgo * HOUR) };
}

describe("evaluateWeeklyDigest (#363)", () => {
  it("allows one weekly period plus one day", () => {
    expect(MAX_DIGEST_AGE_HOURS).toBe(8 * 24);
  });

  it("passes yesterday's Monday digest and prints the state lines", () => {
    const result = evaluateWeeklyDigest(digestAt(25.5), NOW);
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.lines[0]).toMatch(/^OK: newest weekly digest \(2026-W44\) generated 1\.1d ago/);
    expect(result.lines.slice(1)).toEqual([
      "LAST_DIGEST_WEEK=2026-W44",
      "LAST_DIGEST_GENERATED=2026-11-02T07:30:00.000Z",
    ]);
  });

  it("passes a digest exactly at the limit (next Monday, before that week's run)", () => {
    expect(evaluateWeeklyDigest(digestAt(MAX_DIGEST_AGE_HOURS), NOW).ok).toBe(true);
  });

  it("alerts DIGEST_STALE when the Monday run was missed or failed", () => {
    // Previous digest from Monday a week earlier: 8d 01h30m before this Tuesday 09:00.
    const result = evaluateWeeklyDigest(digestAt(8 * 24 + 1.5, "2026-W43"), NOW);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toMatch(/^ALERT\[DIGEST_STALE\]: newest weekly digest \(2026-W43\) was generated 8\.1d ago/);
    expect(result.lines.slice(1)).toEqual([
      "LAST_DIGEST_WEEK=2026-W43",
      "LAST_DIGEST_GENERATED=2026-10-26T07:30:00.000Z",
    ]);
  });

  it("alerts DIGEST_STALE on an unreadable generated_at instead of passing it", () => {
    const result = evaluateWeeklyDigest({ week: "2026-W44", generated_at: "infinity" }, NOW);
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toMatch(/^ALERT\[DIGEST_STALE\]: .* at an unreadable time \(invalid\)/);
  });

  it("alerts DIGEST_NONE when no digest was ever stored", () => {
    for (const latest of [undefined, null]) {
      const result = evaluateWeeklyDigest(latest, NOW);
      expect(result.exitCode).toBe(1);
      expect(result.lines).toEqual([
        "ALERT[DIGEST_NONE]: no weekly digest ever stored (weekly_digests is empty)",
        "LAST_DIGEST_WEEK=none",
        "LAST_DIGEST_GENERATED=none",
      ]);
    }
  });

  it("cannot forge an alert reason or split a line through the week value", () => {
    const result = evaluateWeeklyDigest(digestAt(1, "ALERT[STALLED]\nx"), NOW);
    expect(result.ok).toBe(true);
    expect(result.lines.join("\n")).not.toContain("ALERT[");
    expect(result.lines).toHaveLength(3);
  });
});

describe("cron-gap-detector.yml weekly-digest job (#363)", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/cron-gap-detector.yml"), "utf8");

  /** The text of one top-level job, from its key to the next job key or end of file. */
  function jobBlock(name: string): string {
    const lines = workflow.split("\n");
    const start = lines.indexOf(`  ${name}:`);
    if (start === -1) return "";
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line));
    return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join("\n");
  }

  it("runs the digest check in its own job with the database secret", () => {
    const job = jobBlock("check-weekly-digest-gap");
    expect(job).toContain("run: node scripts/check-weekly-digest-gap.mjs");
    expect(job).toContain("DATABASE_URL: ${{ secrets.DATABASE_URL }}");
  });

  it("lets the digest check fail the job and stays out of the ingestion job", () => {
    const job = jobBlock("check-weekly-digest-gap");
    expect(job).not.toBe("");
    expect(job).not.toMatch(/continue-on-error|\|\|\s*true|needs:/);
    expect(jobBlock("check-ingestion-gap")).not.toContain("node scripts/check-weekly-digest-gap.mjs");
  });
});

describe("check-weekly-digest-gap.mjs failure exits (#363)", () => {
  // Absolute path: the script only runs main() when argv[1] matches its own file URL.
  const script = resolve(__dirname, "../../scripts/check-weekly-digest-gap.mjs");

  function run(databaseUrl?: string) {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    if (databaseUrl !== undefined) env.DATABASE_URL = databaseUrl;
    const result = spawnSync(process.execPath, [script], { env, encoding: "utf8", timeout: 20_000 });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  it("exits 1 with ERROR: when DATABASE_URL is not set", () => {
    const { status, output } = run();
    expect(status).toBe(1);
    expect(output).toContain("ERROR:");
  });

  it("exits non-zero and leaks no credentials when the database is unreachable", () => {
    const url = "postgresql://user:fake-pw-123@127.0.0.1:1/db";
    const { status, output } = run(url);
    expect(status).not.toBeNull();
    expect(status).not.toBe(0);
    expect(output).toContain("ERROR:");
    expect(output).not.toContain(url);
    expect(output).not.toContain("fake-pw-123");
  }, 30_000);
});
