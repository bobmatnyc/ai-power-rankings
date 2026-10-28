/**
 * #329: guards on the model metrics load workflow (D96 pattern).
 *
 * Why: `.github/workflows/load-model-metrics.yml` writes to production from a public repository,
 *   and its metrics file arrives as a secret. A non-dispatch trigger, a write or an activation by
 *   default, a secret in `run:` text, or a figure in the log would each break a ruling.
 * What: reads the workflow as text. `workflow_dispatch` is the only trigger; `dry_run` defaults
 *   to true and `activate` to false; the metrics write needs `confirm: load-model-metrics` and the
 *   activation `confirm: activate-model-metrics`; secrets appear only as `env:` values; the job
 *   runs only from main; `--apply` and `--activate` occur once, in the write step; every script
 *   run passes `--hide-values`. Each text check also runs against a mutated copy and must throw.
 *   The mode, staging and dry-run step scripts run under bash with a stub `npx`.
 * Test: `npx vitest run tests/unit/load-model-metrics-workflow-329.test.ts`. Needs `bash`.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const WORKFLOW = join(process.cwd(), ".github/workflows/load-model-metrics.yml");
const load = () => readFileSync(WORKFLOW, "utf8");

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
}

function assertSafeDefaults(text: string): void {
  const code = codeLines(text).join("\n");
  expect(code).toMatch(/\n {6}dry_run:\n(?: {8}.*\n)*? {8}type: boolean\n(?: {8}.*\n)*? {8}default: true\n/);
  expect(code).toMatch(/\n {6}activate:\n(?: {8}.*\n)*? {8}type: boolean\n(?: {8}.*\n)*? {8}default: false\n/);
  expect(code).toMatch(/\n {6}confirm:\n(?: {8}.*\n)*? {8}default: ''\n/);
  expect(code).toContain('if [ "$CONFIRM" != "activate-model-metrics" ]; then');
  expect(code).toContain('if [ "$CONFIRM" != "load-model-metrics" ]; then');
  expect(code).not.toContain("load-model-seed\"");
  expect(code).toMatch(/id: write\n {8}if: \$\{\{ success\(\) && .* && steps\.dryrun\.outcome == 'success' \}\}/);
}

function assertSecretsEnvOnly(text: string): void {
  const lines = codeLines(text);
  const secretLines = lines.filter((line) => line.includes("secrets."));
  expect(secretLines.map((l) => l.trim()).sort()).toEqual([
    "DATABASE_URL: ${{ secrets.DATABASE_URL }}",
    "DATABASE_URL: ${{ secrets.DATABASE_URL }}",
    "MODEL_METRICS_JSON_B64: ${{ secrets.MODEL_METRICS_JSON_B64 }}",
  ]);
  const code = lines.join("\n");
  expect(code).not.toMatch(/\$\{?DATABASE_URL\b/);
  expect(code.match(/\$\{?MODEL_METRICS_JSON_B64\b/g)).toHaveLength(2); // the emptiness test and the decode pipe
  expect(code).not.toMatch(/cat "\$RUNNER_TEMP\/model-metrics\.json"|cat "\$METRICS_FILE"/);
  expect(code).not.toMatch(/\bset -[a-z]*x/);
  // No `${{ }}` expression inside a run block.
  for (const id of ["mode", "stage", "dryrun", "write", "summary"]) expect(stepRunScript(text, id)).not.toContain("${{");
}

function assertMainOnly(text: string): void {
  expect(codeLines(text).join("\n")).toMatch(
    /\njobs:\n {2}load-model-metrics:\n(?: {4}\S.*\n)*? {4}if: github\.ref == 'refs\/heads\/main'\n(?: {4}\S.*\n)*? {4}steps:\n/
  );
}

function assertSingleApplyAndHiddenValues(text: string): void {
  const code = codeLines(text).join("\n");
  expect(code.split("--apply").length - 1).toBe(1);
  expect(code.split("--activate").length - 1).toBe(1);
  expect(stepRunScript(text, "write")).toContain("--apply --hide-values");
  expect(stepRunScript(text, "write")).toContain("args+=(--activate)");
  expect(stepRunScript(text, "dryrun")).toContain("--dry-run --hide-values");
  expect(code.match(/scripts\/load-model-metrics\.ts/g)).toHaveLength(2);
}

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

describe("load-model-metrics workflow (#329)", () => {
  it("is triggered by workflow_dispatch only", () => assertDispatchOnly(load()));
  it("defaults to a dry run with no activation, with two distinct confirmations", () => assertSafeDefaults(load()));
  it("passes secrets through env only and never prints the metrics file", () => assertSecretsEnvOnly(load()));
  it("runs the job only when dispatched from main", () => assertMainOnly(load()));
  it("has one --apply and one --activate, in the write step, and hides values", () => assertSingleApplyAndHiddenValues(load()));

  it("removes the staged file on every outcome, and shares the seed load's concurrency group", () => {
    const code = codeLines(load()).join("\n");
    expect(code).toMatch(/id: cleanup\n {8}if: \$\{\{ always\(\) \}\}\n {8}run: rm -f "\$RUNNER_TEMP\/model-metrics\.json"/);
    expect(code).toMatch(/\nconcurrency:\n {2}group: load-model-seed-329\n {2}cancel-in-progress: false\n/);
    expect(code).toMatch(/\npermissions:\n {2}contents: read\n/);
  });

  it("names the #318/#317 activation gate in its header", () => {
    expect(load()).toMatch(/never dispatch with `activate: true` before #318 has merged and the #317 audit/);
  });

  it("fails each check against a mutated workflow", () => {
    const text = load();
    const mutants: [string, (t: string) => void][] = [
      [text.replace("on:\n  workflow_dispatch:", "on:\n  push:\n  workflow_dispatch:"), assertDispatchOnly],
      [text.replace(/(dry_run:\n(?: {8}.*\n)*? {8}default: )true/, "$1false"), assertSafeDefaults],
      [text.replace(/(activate:\n(?: {8}.*\n)*? {8}default: )false/, "$1true"), assertSafeDefaults],
      [text.replace('"$CONFIRM" != "activate-model-metrics"', '"$CONFIRM" != "load-model-metrics"'), assertSafeDefaults],
      [text.replace("status=0\n", 'status=0\n          echo "$MODEL_METRICS_JSON_B64"\n'), assertSecretsEnvOnly],
      [text.replace('args=(--metrics-file "$METRICS_FILE" --dry-run', 'args=(--metrics-file "${{ steps.stage.outputs.path }}" --dry-run'), assertSecretsEnvOnly],
      [text.replace("    if: github.ref == 'refs/heads/main'\n", ""), assertMainOnly],
      [text.replace("--apply --hide-values", "--apply"), assertSingleApplyAndHiddenValues],
    ];
    for (const [mutated, check] of mutants) {
      expect(mutated).not.toBe(text);
      expect(() => check(mutated)).toThrow();
    }
  });
});

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
  const work = mkdtempSync(join(tmpdir(), "metrics-329-"));
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
  return { code: res.status, out: `${res.stdout}${res.stderr}`, read, work };
}

describe("load-model-metrics workflow step scripts (#329)", () => {
  it.each([
    ["the default inputs", { DRY_RUN: "true", ACTIVATE: "false", CONFIRM: "" }, 0, "mode=dry-run"],
    ["a write with the seed-load confirm", { DRY_RUN: "false", ACTIVATE: "false", CONFIRM: "load-model-seed" }, 1, ""],
    ["a write with the metrics confirm", { DRY_RUN: "false", ACTIVATE: "false", CONFIRM: "load-model-metrics" }, 0, "mode=apply\n"],
    ["activation with the metrics confirm", { DRY_RUN: "false", ACTIVATE: "true", CONFIRM: "load-model-metrics" }, 1, ""],
    ["activation with the activation confirm", { DRY_RUN: "false", ACTIVATE: "true", CONFIRM: "activate-model-metrics" }, 0, "mode=apply-activate"],
  ])("mode selection on %s", (_name, env, code, mode) => {
    const res = runStep("mode", env);
    expect(res.code).toBe(code);
    if (mode) expect(res.read("output.txt")).toContain(mode);
    else expect(res.read("output.txt")).not.toContain("mode=");
  });

  it("staging decodes the secret to a file without printing it, and refuses a missing secret", () => {
    const json = '{"checked_at":"2026-10-21","metrics":[]}';
    const ok = runStep("stage", { MODEL_METRICS_JSON_B64: Buffer.from(json).toString("base64") });
    expect(ok.code).toBe(0);
    expect(ok.read("model-metrics.json")).toBe(json);
    expect(ok.out).not.toContain("checked_at");
    expect(ok.read("output.txt")).toContain(`path=${ok.work}/model-metrics.json`);
    const missing = runStep("stage", { MODEL_METRICS_JSON_B64: "" });
    expect(missing.code).toBe(1);
    expect(missing.read("output.txt")).toBe("");
  });

  it("the dry run passes the file, hides values, checks activation when asked and keeps the totals", () => {
    const res = runStep("dryrun", {
      METRICS_FILE: "/runner/model-metrics.json",
      CHECK_ACTIVATION: "true",
      STUB_EXIT: "1",
      STUB_OUTPUT: "using DATABASE_URL (NODE_ENV=production), database sha256:abc\ntotals: 13 metric row(s), 13 update, 0 unchanged, 0 refused; activation: 12 activate, 0 already active, 1 refused",
    });
    expect(res.code).toBe(1);
    expect(res.read("npx.log").trim()).toBe("tsx scripts/load-model-metrics.ts --metrics-file /runner/model-metrics.json --dry-run --hide-values --check-activation");
    expect(res.out).not.toContain("sha256");
    expect(res.read("metrics-counts-dry-run.txt")).toMatch(/^totals: 13 metric row\(s\)/);
  });

  it("the write passes --activate only in the activation mode", () => {
    const plain = runStep("write", { METRICS_FILE: "/f.json", MODE: "apply", STUB_OUTPUT: "apply: committed" });
    expect(plain.read("npx.log").trim()).toBe("tsx scripts/load-model-metrics.ts --metrics-file /f.json --apply --hide-values");
    const act = runStep("write", { METRICS_FILE: "/f.json", MODE: "apply-activate", STUB_OUTPUT: "apply: committed" });
    expect(act.read("npx.log").trim()).toBe("tsx scripts/load-model-metrics.ts --metrics-file /f.json --apply --hide-values --activate");
  });
});
