/**
 * A production migration apply runs only from main (#355).
 *
 * Why: `.github/workflows/apply-migration.yml` is dispatchable on any ref and passes the
 * production DATABASE_URL to `scripts/apply-migrations.ts`, so a dispatch on a branch could
 * apply that branch's migration files to production.
 * What: the script's `applyMigrations` refuses a real apply when GITHUB_ACTIONS is "true"
 * and GITHUB_REF is not refs/heads/main, before calling its connect function; it connects
 * for main, for a dry run on any ref, and outside Actions. The workflow's guard step runs
 * only on an apply, comes before the first step that receives DATABASE_URL, and, run under
 * bash, exits 1 naming the ref for a branch and 0 for main.
 * Test: `npx vitest run tests/unit/apply-migrations-main-only-355.test.ts`. Needs `bash`.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyMigrations, type MigrationDb } from "../../scripts/apply-migrations";

vi.setConfig({ testTimeout: 60_000 });

const BRANCH_REF = "refs/heads/feature/some-branch";
const MAIN_REF = "refs/heads/main";

describe("applyMigrations ref guard (#355)", () => {
  let stderr: string[];

  beforeEach(() => {
    stderr = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      stderr.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A connect stub that records the call and then fails, so no real driver is reached. */
  function stubConnect(): { connect: () => Promise<MigrationDb>; calls: () => number } {
    let calls = 0;
    return {
      connect: async () => {
        calls += 1;
        throw new Error("stub connect: no database in tests");
      },
      calls: () => calls,
    };
  }

  const run = applyMigrations;

  it("refuses an apply in Actions from a non-main ref without connecting, naming the ref", async () => {
    const stub = stubConnect();
    const code = await run(["--only", "0013_candidate.sql"], { GITHUB_ACTIONS: "true", GITHUB_REF: BRANCH_REF }, stub.connect);
    expect(code).toBe(1);
    expect(stub.calls()).toBe(0);
    expect(stderr.join("\n")).toContain(`refusing to apply migrations from ref '${BRANCH_REF}'`);
  });

  it("refuses an apply in Actions when GITHUB_REF is unset", async () => {
    const stub = stubConnect();
    const code = await run(["--only", "0013_candidate.sql"], { GITHUB_ACTIONS: "true" }, stub.connect);
    expect(code).toBe(1);
    expect(stub.calls()).toBe(0);
    expect(stderr.join("\n")).toContain("refusing to apply migrations from ref '(unset)'");
  });

  it.each([
    ["an apply in Actions on main", ["--only", "0013_candidate.sql"], { GITHUB_ACTIONS: "true", GITHUB_REF: MAIN_REF }],
    ["a dry run in Actions on a branch", ["--dry-run"], { GITHUB_ACTIONS: "true", GITHUB_REF: BRANCH_REF }],
    ["an apply outside Actions", ["--only", "0013_candidate.sql"], { GITHUB_REF: BRANCH_REF }],
  ])("proceeds to connect for %s", async (_label, argv, env) => {
    const stub = stubConnect();
    await run(argv, env, stub.connect);
    expect(stub.calls()).toBe(1);
    expect(stderr.join("\n")).not.toContain("refusing to apply");
  });
});

const WORKFLOW = join(process.cwd(), ".github/workflows/apply-migration.yml");

/** Each step's text, keyed by order, so conditions and env can be checked per step. */
function steps(): string[] {
  const text = readFileSync(WORKFLOW, "utf8");
  return text.split(/\n(?= {6}- name: )/).slice(1);
}

function guardStep(): string {
  const step = steps().find((s) => /\n {8}id: apply-ref-guard\n/.test(s));
  expect(step, "step with id apply-ref-guard").toBeDefined();
  return step!;
}

/** The guard step's `run: |` body, de-indented. */
function guardScript(): string {
  const lines = guardStep().split("\n");
  const runAt = lines.findIndex((l) => /^ {8}run: \|\s*$/.test(l));
  expect(runAt, "run block of apply-ref-guard").toBeGreaterThan(0);
  const body: string[] = [];
  for (const line of lines.slice(runAt + 1)) {
    if (line.trim() !== "" && line.search(/\S/) <= 8) break;
    body.push(line);
  }
  return `${body.map((l) => l.slice(10)).join("\n")}\n`;
}

describe("apply-migration workflow ref guard (#355)", () => {
  it("runs the guard only on an apply, and before any step that receives DATABASE_URL", () => {
    const all = steps();
    const guardAt = all.findIndex((s) => /\n {8}id: apply-ref-guard\n/.test(s));
    expect(guardAt, "guard step").toBeGreaterThanOrEqual(0);
    const firstSecretAt = all.findIndex((s) => s.includes("secrets.DATABASE_URL"));
    expect(guardAt).toBeLessThan(firstSecretAt);
    const guard = all[guardAt]!;
    expect(guard).toContain("if: ${{ inputs.dry_run == false }}");
    expect(guard).toContain("RUN_REF: ${{ github.ref }}");
    expect(guard).not.toMatch(/continue-on-error|always\(\)/);
    // No later step may run after the guard fails.
    for (const later of all.slice(guardAt + 1)) {
      expect(later).not.toMatch(/always\(\)|failure\(\)|continue-on-error/);
    }
  });

  it.each([
    [BRANCH_REF, 1],
    ["refs/tags/v1", 1],
    [MAIN_REF, 0],
  ])("guard script with ref %s exits %i", (ref, expected) => {
    const dir = mkdtempSync(join(tmpdir(), "apply-ref-guard-355-"));
    try {
      const script = join(dir, "guard.sh");
      writeFileSync(script, guardScript());
      const res = spawnSync("bash", [script], { env: { PATH: process.env["PATH"] ?? "", RUN_REF: ref }, encoding: "utf8" });
      expect(res.status).toBe(expected);
      if (expected === 1) {
        expect(res.stdout).toContain(`::error::Refusing to apply a migration from ref '${ref}'`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
