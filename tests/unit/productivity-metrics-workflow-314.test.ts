/**
 * #314: guards on the productivity metrics load workflow (pattern of load-model-metrics.yml).
 *
 * Why: `.github/workflows/load-productivity-metrics.yml` writes to production. A non-dispatch
 *   trigger, a write by default, a write without the confirmation, a secret in `run:` text or a
 *   run from a branch would each break the D80/D69 release step.
 * What: reads the workflow as text and checks the trigger, the input defaults, the main-only job
 *   guard, that secrets appear only as `env:` values and that `--apply` occurs once, in the write
 *   step gated on the dry run. The "Select mode" script runs under bash for each input case.
 * Test: `npx vitest run tests/unit/productivity-metrics-workflow-314.test.ts`. Needs `bash`.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TEXT = readFileSync(join(process.cwd(), ".github/workflows/load-productivity-metrics.yml"), "utf8");
const CODE = TEXT.split("\n").filter((line) => !/^\s*#/.test(line));

/** The `run: |` body of the step with `id: <id>`, de-indented. */
function stepScript(id: string): string {
  const start = CODE.findIndex((line) => line.trim() === `id: ${id}`);
  const run = CODE.findIndex((line, i) => i > start && /^ {8}run: \|$/.test(line));
  const body: string[] = [];
  for (const line of CODE.slice(run + 1)) {
    if (line.trim() !== "" && !line.startsWith("          ")) break;
    body.push(line.slice(10));
  }
  return body.join("\n");
}

function selectMode(env: Record<string, string>): { status: number | null; output: string } {
  const dir = mkdtempSync(join(tmpdir(), "wf314-"));
  const out = join(dir, "out");
  try {
    const childEnv = { PATH: process.env["PATH"] ?? "", GITHUB_OUTPUT: out, ...env } as unknown as NodeJS.ProcessEnv;
    const res = spawnSync("bash", ["-c", stepScript("mode")], { env: childEnv, encoding: "utf8" });
    let output = "";
    try {
      output = readFileSync(out, "utf8");
    } catch {
      output = "";
    }
    return { status: res.status, output };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("#314 load-productivity-metrics workflow", () => {
  it("is dispatch-only, runs only from main and defaults to a dry run", () => {
    const on = CODE.findIndex((line) => line === "on:");
    const rest = CODE.slice(on + 1);
    const block = rest.slice(0, rest.findIndex((line) => /^\S/.test(line)));
    expect(block.filter((line) => /^ {2}\S/.test(line))).toEqual(["  workflow_dispatch:"]);
    expect(CODE.join("\n")).toMatch(/\n {6}dry_run:\n(?: {8}.*\n)*? {8}type: boolean\n(?: {8}.*\n)*? {8}default: true\n/);
    expect(CODE.join("\n")).toMatch(/\n {6}confirm:\n(?: {8}.*\n)*? {8}default: ''\n/);
    expect(CODE).toContain("    if: github.ref == 'refs/heads/main'");
  });

  it("passes --apply once, in the write step gated on the dry run, and secrets only as env values", () => {
    expect(CODE.filter((line) => line.includes("--apply"))).toHaveLength(1);
    expect(stepScript("write")).toContain("scripts/load-productivity-metrics.ts --apply");
    expect(stepScript("dryrun")).toContain("scripts/load-productivity-metrics.ts --dry-run");
    expect(CODE.join("\n")).toContain("if: ${{ success() && steps.mode.outputs.mode == 'apply' && steps.dryrun.outcome == 'success' }}");
    expect(CODE.filter((line) => line.includes("secrets.")).map((line) => line.trim())).toEqual([
      "DATABASE_URL: ${{ secrets.DATABASE_URL }}",
      "DATABASE_URL: ${{ secrets.DATABASE_URL }}",
    ]);
  });

  it.each([
    [{ DRY_RUN: "true", CONFIRM: "" }, 0, "mode=dry-run"],
    [{ DRY_RUN: "true", CONFIRM: "load-productivity-metrics" }, 0, "mode=dry-run"],
    [{ DRY_RUN: "false", CONFIRM: "" }, 1, ""],
    [{ DRY_RUN: "false", CONFIRM: "load-model-metrics" }, 1, ""],
    [{ DRY_RUN: "false", CONFIRM: "load-productivity-metrics" }, 0, "mode=apply"],
  ])("select mode %j exits %i with %j", (env, status, output) => {
    const res = selectMode(env);
    expect(res.status).toBe(status);
    expect(res.output.trim()).toBe(output);
  });
});
