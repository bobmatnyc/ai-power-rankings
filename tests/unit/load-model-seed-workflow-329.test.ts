/**
 * #329: guards on the model seed load workflow (D96 pattern).
 *
 * Why: `.github/workflows/load-model-seed.yml` writes to production from a public repository.
 *   A push, pull_request or schedule trigger, a dispatch that writes by default, or the
 *   DATABASE_URL secret in `run:` text would each write without clearance or leak the secret.
 * What: reads the workflow as text. `workflow_dispatch` is the only trigger; `dry_run` defaults
 *   to true and a write also needs the typed `confirm`; the secret appears only as an `env:`
 *   value; the write runs only after a successful dry run; the job runs only from main; `--apply`
 *   occurs once, in the write step. Each text check also runs against a mutated copy and must
 *   throw. The mode and dry-run step scripts run under bash with a stub `npx`.
 * Test: `npx vitest run tests/unit/load-model-seed-workflow-329.test.ts`. Needs `bash`.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Tests spawn child processes or shell scripts, which can pass 5000 ms on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const WORKFLOW = join(process.cwd(), ".github/workflows/load-model-seed.yml");
const load = () => readFileSync(WORKFLOW, "utf8");

/** Lines without YAML comments, so the header prose cannot satisfy or trip a check. */
function codeLines(text: string): string[] {
  return text.split("\n").filter((line) => !/^\s*#/.test(line));
}

function assertDispatchOnly(text: string): void {
  const lines = codeLines(text);
  const start = lines.findIndex((line) => /^on:\s*$/.test(line));
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\S/.test(line));
  const block = end === -1 ? rest : rest.slice(0, end);
  expect(block.filter((line) => /^ {2}\S/.test(line)).map((line) => line.trim().replace(/:.*$/, ""))).toEqual(["workflow_dispatch"]);
  for (const banned of ["push", "pull_request", "pull_request_target", "schedule", "workflow_run", "workflow_call", "repository_dispatch"]) {
    expect(block.join("\n")).not.toMatch(new RegExp(`\\b${banned}\\b`));
  }
}

function assertDryRunDefault(text: string): void {
  const code = codeLines(text).join("\n");
  expect(code).toMatch(/\n {6}dry_run:\n(?: {8}.*\n)*? {8}type: boolean\n(?: {8}.*\n)*? {8}default: true\n/);
  expect(code).toMatch(/\n {6}confirm:\n(?: {8}.*\n)*? {8}default: ''\n/);
  expect(code).toContain('if [ "$DRY_RUN" != "false" ]; then');
  expect(code).toContain('if [ "$CONFIRM" != "load-model-seed" ]; then');
  expect(code).toMatch(
    /id: write\n {8}if: \$\{\{ success\(\) && steps\.mode\.outputs\.mode == 'apply' && steps\.dryrun\.outcome == 'success' \}\}/
  );
}

function assertSecretEnvOnly(text: string): void {
  const lines = codeLines(text);
  const secretLines = lines.filter((line) => line.includes("secrets."));
  expect(secretLines.length).toBe(2);
  for (const line of secretLines) expect(line).toBe("          DATABASE_URL: ${{ secrets.DATABASE_URL }}");
  const code = lines.join("\n");
  expect(code).not.toMatch(/\$\{?DATABASE_URL\b/);
  expect(code).not.toMatch(/\bset -[a-z]*x/);
  expect(code).not.toMatch(/secrets: inherit|toJSON\(secrets\)/);
}

function assertMainOnly(text: string): void {
  expect(codeLines(text).join("\n")).toMatch(
    /\njobs:\n {2}load-model-seed:\n(?: {4}\S.*\n)*? {4}if: github\.ref == 'refs\/heads\/main'\n(?: {4}\S.*\n)*? {4}steps:\n/
  );
}

/** The `run: |` block of the step whose `id:` is `stepId`, de-indented. */
function stepRunScript(text: string, stepId: string): string {
  const lines = text.split("\n");
  const idAt = lines.findIndex((line) => line.trim() === `id: ${stepId}`);
  expect(idAt, `step id ${stepId}`).toBeGreaterThanOrEqual(0);
  const runAt = lines.findIndex((line, i) => i > idAt && /^\s+run: \|\s*$/.test(line));
  const keyIndent = lines[runAt]!.search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(runAt + 1)) {
    if (line.trim() !== "" && line.search(/\S/) <= keyIndent) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter((l) => l.trim() !== "").map((l) => l.search(/\S/)));
  return `${body.map((l) => l.slice(indent)).join("\n")}\n`;
}

function assertSingleApply(text: string): void {
  expect(text.split("--apply").length - 1).toBe(1);
  expect(stepRunScript(text, "write")).toContain("--apply");
}

describe("load-model-seed workflow (#329)", () => {
  it("is triggered by workflow_dispatch only", () => assertDispatchOnly(load()));
  it("defaults to a dry run and gates the write on the typed confirmation and a clean dry run", () => assertDryRunDefault(load()));
  it("passes DATABASE_URL through env only", () => assertSecretEnvOnly(load()));
  it("runs the job only when dispatched from main", () => assertMainOnly(load()));
  it("has exactly one --apply, in the write step", () => assertSingleApply(load()));

  it("reads contents only, never overlaps a run, and pins actions like merge-duplicate-tools.yml", () => {
    const code = codeLines(load()).join("\n");
    expect(code).toMatch(/\npermissions:\n {2}contents: read\n/);
    expect(code).toMatch(/\nconcurrency:\n {2}group: \S+\n {2}cancel-in-progress: false\n/);
    expect(code.match(/uses: \S+/g)).toEqual(["uses: actions/checkout@v4", "uses: actions/setup-node@v4"]);
    expect(code).not.toMatch(/continue-on-error/);
  });

  it("fails each check against a mutated workflow", () => {
    const text = load();
    const mutants: [string, (t: string) => void][] = [
      [text.replace("on:\n  workflow_dispatch:", "on:\n  schedule:\n    - cron: '0 0 * * *'\n  workflow_dispatch:"), assertDispatchOnly],
      [text.replace("on:\n  workflow_dispatch:", "on:\n  pull_request:\n  workflow_dispatch:"), assertDispatchOnly],
      [text.replace(/(dry_run:\n(?: {8}.*\n)*? {8}default: )true/, "$1false"), assertDryRunDefault],
      [text.replace(" && steps.dryrun.outcome == 'success'", ""), assertDryRunDefault],
      [text.replace("status=0\n", 'status=0\n          echo "$DATABASE_URL"\n'), assertSecretEnvOnly],
      [text.replace("    if: github.ref == 'refs/heads/main'\n", ""), assertMainOnly],
      [`${text.trimEnd()}\n\n      - name: Again\n        run: npx tsx scripts/load-model-seeds.ts --apply\n`, assertSingleApply],
    ];
    for (const [mutated, check] of mutants) {
      expect(mutated).not.toBe(text);
      expect(() => check(mutated)).toThrow();
    }
  });
});

// Prints STUB_OUTPUT and exits STUB_EXIT; logs its arguments.
const STUB_NPX = `#!/bin/bash
printf '%s\\n' "$*" >> "$STUB_LOG"
printf '%s\\n' "$STUB_OUTPUT"
exit "\${STUB_EXIT:-0}"
`;

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function runStep(stepId: string, env: Record<string, string>) {
  const work = mkdtempSync(join(tmpdir(), "seed-329-"));
  tempDirs.push(work);
  const bin = join(work, "bin");
  if (!existsSync(bin)) mkdirSync(bin);
  writeFileSync(join(bin, "npx"), STUB_NPX);
  chmodSync(join(bin, "npx"), 0o755);
  const script = join(work, `${stepId}.sh`);
  writeFileSync(script, stepRunScript(load(), stepId));
  const read = (name: string) => (existsSync(join(work, name)) ? readFileSync(join(work, name), "utf8") : "");
  const res = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      PATH: `${bin}:${process.env["PATH"] ?? ""}`,
      RUNNER_TEMP: work,
      GITHUB_OUTPUT: join(work, "output.txt"),
      STUB_LOG: join(work, "npx.log"),
      ...env,
    },
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}`, read };
}

describe("load-model-seed workflow step scripts (#329)", () => {
  it.each([
    ["the default inputs", { SEED: "all", DRY_RUN: "true", CONFIRM: "" }, 0, "mode=dry-run"],
    ["dry_run false with a wrong confirm", { SEED: "all", DRY_RUN: "false", CONFIRM: "yes" }, 1, ""],
    ["dry_run false with the typed confirm", { SEED: "closed", DRY_RUN: "false", CONFIRM: "load-model-seed" }, 0, "mode=apply"],
    ["an unknown seed", { SEED: "muse", DRY_RUN: "true", CONFIRM: "" }, 1, ""],
    // #329: the per-major seed and the lifecycle status step.
    ["the majors seed", { SEED: "majors", DRY_RUN: "true", CONFIRM: "" }, 0, "mode=dry-run"],
    ["set_status with seed all", { SEED: "all", SET_STATUS: "true", DRY_RUN: "true", CONFIRM: "" }, 0, "set_status=true"],
    ["set_status with one seed", { SEED: "closed", SET_STATUS: "true", DRY_RUN: "true", CONFIRM: "" }, 1, ""],
    ["a malformed set_status", { SEED: "all", SET_STATUS: "yes", DRY_RUN: "true", CONFIRM: "" }, 1, ""],
    // #334: the overwrite input takes slug:column pairs of curated columns only.
    ["an overwrite list", { SEED: "all", OVERWRITE: "glm:licence,deepseek-pro:hf_repo", DRY_RUN: "true", CONFIRM: "" }, 0, "overwrite=glm:licence,deepseek-pro:hf_repo"],
    ["an overwrite of a non-curated column", { SEED: "all", OVERWRITE: "glm:status", DRY_RUN: "true", CONFIRM: "" }, 1, ""],
    ["an overwrite with shell text", { SEED: "all", OVERWRITE: "glm:licence --apply", DRY_RUN: "true", CONFIRM: "" }, 1, ""],
    ["an overwrite with a trailing comma", { SEED: "all", OVERWRITE: "glm:licence,", DRY_RUN: "true", CONFIRM: "" }, 1, ""],
  ])("mode selection on %s", (_name, env, code, mode) => {
    const res = runStep("mode", env);
    expect(res.code).toBe(code);
    if (mode) expect(res.read("output.txt")).toContain(mode);
    else expect(res.read("output.txt")).not.toContain("mode=");
  });

  it("the dry run passes the seed, drops the fingerprint line, keeps the totals and exit status", () => {
    const res = runStep("dryrun", {
      SEED: "open-weight",
      STUB_EXIT: "1",
      STUB_OUTPUT: "using DATABASE_URL (NODE_ENV=production), database sha256:abc\nREFUSED: glm\ntotals: 5 row(s), 0 insert, 0 update, 4 unchanged, 1 refused",
    });
    expect(res.code).toBe(1);
    expect(res.read("npx.log").trim()).toBe("tsx scripts/load-model-seeds.ts --seed open-weight --dry-run");
    expect(res.out).not.toContain("sha256");
    expect(res.read("seed-counts-dry-run.txt").trim()).toBe("totals: 5 row(s), 0 insert, 0 update, 4 unchanged, 1 refused");
  });

  it("the dry run with set_status passes --set-status and keeps the status counts", () => {
    const res = runStep("dryrun", {
      SEED: "all",
      SET_STATUS: "true",
      STUB_OUTPUT: "totals: 2 row(s), 2 insert, 0 update, 0 unchanged, 0 refused\nstatus: 2 row(s), 1 set active, 1 set deprecated, 0 unchanged, 0 refused",
    });
    expect(res.code).toBe(0);
    expect(res.read("npx.log").trim()).toBe("tsx scripts/load-model-seeds.ts --seed all --dry-run --set-status");
    expect(res.read("seed-counts-dry-run.txt")).toContain("status: 2 row(s), 1 set active, 1 set deprecated, 0 unchanged, 0 refused");
  });

  // #334: the owner's opt-in reaches both the dry run and the write as one --overwrite argument.
  it.each([
    ["dryrun", "--dry-run"],
    ["write", "--apply"],
  ])("the %s step passes the overwrite list", (stepId, mode) => {
    const res = runStep(stepId, { SEED: "all", OVERWRITE: "glm:licence,kimi:hf_repo", STUB_OUTPUT: "totals: 1 row(s)" });
    expect(res.code).toBe(0);
    expect(res.read("npx.log").trim()).toBe(`tsx scripts/load-model-seeds.ts --seed all ${mode} --overwrite glm:licence,kimi:hf_repo`);
  });
});

describe("load-model-seed workflow header (#334)", () => {
  const header = () => load().split("\non:\n")[0]!;

  it("states which fields the seed owns, which it only fills when empty, and the overwrite input", () => {
    const text = header().replace(/\n# ?/g, " ");
    expect(text).toContain("The seed owns data.modelSeed");
    expect(text).toContain("hf_repo, licence, parameters_b, active_parameters_b and release_date are curated");
    expect(text).toContain("fills each one only when it is empty");
    expect(text).toContain("The `overwrite` input");
    expect(text).toMatch(/open_weight is filled when empty; a stored value that disagrees refuses the row/);
  });
});
