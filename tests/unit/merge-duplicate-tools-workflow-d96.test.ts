/**
 * Guards on the D90 duplicate-tool merge workflow (D96).
 *
 * Why: `.github/workflows/merge-duplicate-tools.yml` writes to production from a public
 * repository. A push or schedule trigger, a dispatch that applies by default, or the
 * DATABASE_URL secret in `run:` text would each write without clearance or leak the secret.
 * What: reads the workflow as text. `workflow_dispatch` is the only trigger; `dry_run`
 * defaults to true and apply also needs the typed `confirm`; the secret appears only as an
 * `env:` value; the apply step runs only after a successful backup; the job runs only from
 * main; `--apply` occurs once, in the apply step. Each text check is also
 * run against a mutated copy (push trigger, apply default, secret in a run line) and must
 * throw. The step scripts run under bash with a stub `npx`: mode selection, a failing or
 * file-less backup, and a summary that carries counts but no fingerprint or file path.
 * Test: `npx vitest run tests/unit/merge-duplicate-tools-workflow-d96.test.ts`. Needs `bash`.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const WORKFLOW = join(process.cwd(), ".github/workflows/merge-duplicate-tools.yml");

function load(): string {
  return readFileSync(WORKFLOW, "utf8");
}

/** Lines without YAML comments, so the header prose cannot satisfy or trip a check. */
function codeLines(text: string): string[] {
  return text.split("\n").filter((line) => !/^\s*#/.test(line));
}

/** The top-level `on:` block, up to the next top-level key. */
function onBlock(text: string): string[] {
  const lines = codeLines(text);
  const start = lines.findIndex((line) => /^on:\s*$/.test(line));
  if (start < 0) throw new Error("no top-level `on:` block");
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\S/.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

/** Criterion 1: `workflow_dispatch` is the only trigger. */
function assertDispatchOnly(text: string): void {
  const block = onBlock(text);
  const triggers = block.filter((line) => /^ {2}\S/.test(line)).map((line) => line.trim().replace(/:.*$/, ""));
  expect(triggers).toEqual(["workflow_dispatch"]);
  for (const banned of ["push", "pull_request", "pull_request_target", "schedule", "workflow_run", "workflow_call", "repository_dispatch"]) {
    expect(block.join("\n")).not.toMatch(new RegExp(`\\b${banned}\\b`));
  }
}

/** Criterion 2: default inputs select a dry run; apply needs dry_run false and the typed confirm. */
function assertDryRunDefault(text: string): void {
  const code = codeLines(text).join("\n");
  expect(code).toMatch(/\n {6}dry_run:\n(?: {8}.*\n)*? {8}type: boolean\n(?: {8}.*\n)*? {8}default: true\n/);
  expect(code).toMatch(/\n {6}confirm:\n(?: {8}.*\n)*? {8}default: ''\n/);
  expect(code).toContain('if [ "$DRY_RUN" != "false" ]; then');
  expect(code).toContain('if [ "$CONFIRM" != "merge-d90-duplicates" ]; then');
  // Every step that can write is gated on the apply mode.
  expect(code).toMatch(/id: backup\n {8}if: \$\{\{ success\(\) && steps\.mode\.outputs\.mode == 'apply' \}\}/);
  expect(code).toMatch(
    /id: apply\n {8}if: \$\{\{ success\(\) && steps\.mode\.outputs\.mode == 'apply' && steps\.backup\.outcome == 'success' \}\}/
  );
}

/** Criterion 3: the secret is referenced by name as an env value only, never printed. */
function assertSecretEnvOnly(text: string): void {
  const lines = codeLines(text);
  const secretLines = lines.filter((line) => line.includes("secrets."));
  expect(secretLines.length).toBe(3);
  for (const line of secretLines) expect(line).toBe("          DATABASE_URL: ${{ secrets.DATABASE_URL }}");
  const code = lines.join("\n");
  expect(code).not.toMatch(/\$\{?DATABASE_URL\b/);
  expect(code).not.toMatch(/\bset -[a-z]*x/);
  expect(code).not.toMatch(/secrets: inherit|toJSON\(secrets\)/);
}

describe("merge-duplicate-tools workflow (D96)", () => {
  it("is triggered by workflow_dispatch only", () => assertDispatchOnly(load()));
  it("defaults to a dry run and gates the backup and apply on the typed confirmation", () => assertDryRunDefault(load()));
  it("passes DATABASE_URL through env only", () => assertSecretEnvOnly(load()));

  it("reads contents only, never overlaps a run, and pins actions like apply-migration.yml", () => {
    const code = codeLines(load()).join("\n");
    expect(code).toMatch(/\npermissions:\n {2}contents: read\n/);
    expect(code).toMatch(/\nconcurrency:\n {2}group: \S+\n {2}cancel-in-progress: false\n/);
    expect(code.match(/uses: \S+/g)).toEqual(["uses: actions/checkout@v4", "uses: actions/setup-node@v4"]);
    expect(code).not.toMatch(/continue-on-error/);
  });

  it("fails each check against a mutated workflow", () => {
    const text = load();
    const withPush = text.replace("on:\n  workflow_dispatch:", "on:\n  push:\n    branches: [main]\n  workflow_dispatch:");
    const applyByDefault = text.replace(/(dry_run:\n(?: {8}.*\n)*? {8}default: )true/, "$1false");
    const secretInRun = text.replace("status=0\n", 'status=0\n          echo "$DATABASE_URL"\n');
    expect(withPush).not.toBe(text);
    expect(applyByDefault).not.toBe(text);
    expect(secretInRun).not.toBe(text);
    expect(() => assertDispatchOnly(withPush)).toThrow();
    expect(() => assertDryRunDefault(applyByDefault)).toThrow();
    expect(() => assertSecretEnvOnly(secretInRun)).toThrow();
  });

  it("runs the job only when dispatched from main", () => assertMainOnly(load()));
  it("has exactly one --apply, in the apply step", () => assertSingleApply(load()));

  it("fails the ref guard, single-apply, confirm and backup-gate checks against mutated workflows", () => {
    const text = load();
    const noGuard = text.replace("    if: github.ref == 'refs/heads/main'\n", "");
    const secondApply = `${text.trimEnd()}\n\n      - name: Apply again\n        run: npx tsx scripts/merge-duplicate-tools.ts --apply backup.json\n`;
    const noConfirm = text.replace(
      /\n {10}if \[ "\$CONFIRM" != "merge-d90-duplicates" \]; then\n(?: {12}.*\n)+? {10}fi\n/,
      "\n"
    );
    const noBackupGate = text.replace(" && steps.backup.outcome == 'success'", "");
    for (const mutated of [noGuard, secondApply, noConfirm, noBackupGate]) expect(mutated).not.toBe(text);
    expect(() => assertMainOnly(noGuard)).toThrow();
    expect(() => assertSingleApply(secondApply)).toThrow();
    expect(() => assertDryRunDefault(noConfirm)).toThrow();
    expect(() => assertDryRunDefault(noBackupGate)).toThrow();
  });
});

/** The job carries a job-level guard, so a dispatch from another ref runs no step. */
function assertMainOnly(text: string): void {
  expect(codeLines(text).join("\n")).toMatch(
    /\njobs:\n {2}merge-duplicate-tools:\n(?: {4}\S.*\n)*? {4}if: github\.ref == 'refs\/heads\/main'\n(?: {4}\S.*\n)*? {4}steps:\n/
  );
}

/** `--apply` occurs once in the whole file, comments included, inside the apply step. */
function assertSingleApply(text: string): void {
  expect(text.split("--apply").length - 1).toBe(1);
  expect(stepRunScript(text, "apply")).toContain("--apply");
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

// Prints STUB_OUTPUT, writes STUB_BACKUP to the `--backup` path when set, exits STUB_EXIT.
const STUB_NPX = `#!/bin/bash
printf '%s\\n' "$*" >> "$STUB_LOG"
if [ "$3" = "--backup" ] && [ -n "\${STUB_BACKUP:-}" ]; then printf '%s' "$STUB_BACKUP" > "$4"; fi
printf '%s\\n' "$STUB_OUTPUT"
exit "\${STUB_EXIT:-0}"
`;

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// A grep that always errors the way a real one does on an unreadable file.
const STUB_GREP_ERROR = `#!/bin/bash
echo "grep: stub read error" >&2
exit 2
`;

function runStep(stepId: string, env: Record<string, string>, dir?: string, stubs: Record<string, string> = {}) {
  const work = dir ?? mkdtempSync(join(tmpdir(), "d96-"));
  if (!dir) tempDirs.push(work);
  const bin = join(work, "bin");
  if (!existsSync(bin)) mkdirSync(bin);
  for (const [name, body] of Object.entries({ npx: STUB_NPX, ...stubs })) {
    writeFileSync(join(bin, name), body);
    chmodSync(join(bin, name), 0o755);
  }
  const script = join(work, `${stepId}.sh`);
  writeFileSync(script, stepRunScript(load(), stepId));
  const read = (name: string) => (existsSync(join(work, name)) ? readFileSync(join(work, name), "utf8") : "");
  const res = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      PATH: `${bin}:${process.env["PATH"] ?? ""}`,
      RUNNER_TEMP: work,
      GITHUB_OUTPUT: join(work, "output.txt"),
      GITHUB_STEP_SUMMARY: join(work, "summary.md"),
      STUB_LOG: join(work, "npx.log"),
      ...env,
    },
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}`, dir: work, read };
}

describe("merge-duplicate-tools workflow step scripts (D96)", () => {
  it.each([
    ["true", "", 0, "mode=dry-run"],
    ["true", "merge-d90-duplicates", 0, "mode=dry-run"],
    ["false", "", 1, ""],
    ["false", "merge-d90", 1, ""],
    ["false", "merge-d90-duplicates", 0, "mode=apply"],
  ])("dry_run=%s confirm=%j exits %i with %j", (dryRun, confirm, code, output) => {
    const r = runStep("mode", { DRY_RUN: dryRun, CONFIRM: confirm });
    expect(r.code).toBe(code);
    expect(r.read("output.txt").trim()).toBe(output);
  });

  it("drops the database fingerprint line from the dry-run log and keeps the totals", () => {
    const r = runStep("dryrun", {
      STUB_OUTPUT: "using DATABASE_URL (NODE_ENV=production), database sha256:0123456789abcdef\npair 1/7: a -> b [ready]\ntotals: 7 pair(s), 0 unresolved",
    });
    expect(r.code).toBe(0);
    expect(r.out).not.toContain("sha256:");
    expect(r.out).toContain("pair 1/7");
    expect(r.read("d90-counts-dry-run.txt")).toBe("totals: 7 pair(s), 0 unresolved\n");
  });

  it("propagates a failing dry run or backup exit code", () => {
    expect(runStep("dryrun", { STUB_OUTPUT: "ERROR: connection refused", STUB_EXIT: "1" }).code).toBe(1);
    expect(runStep("backup", { STUB_OUTPUT: "ERROR: permission denied", STUB_EXIT: "1" }).code).toBe(1);
  });

  it("propagates a failing apply exit code", () => {
    const r = runStep("apply", { STUB_OUTPUT: "--apply: rolled back, nothing written: deadlock", STUB_EXIT: "1" });
    expect(r.code).toBe(1);
    expect(r.read("d90-counts-apply.txt")).toBe("");
  });

  it("tolerates a count grep with no match but fails on a grep error", () => {
    const noMatch = runStep("dryrun", { STUB_OUTPUT: "pair 1/7: a -> b [ready]" });
    expect(noMatch.code).toBe(0);
    expect(noMatch.read("d90-counts-dry-run.txt")).toBe("");
    for (const step of ["dryrun", "apply"]) {
      expect(runStep(step, { STUB_OUTPUT: "totals: 7 pair(s), 0 unresolved" }, undefined, { grep: STUB_GREP_ERROR }).code).toBe(2);
    }
    const backup = runStep("backup", { STUB_BACKUP: "{}", STUB_OUTPUT: "backup: wrote x: 1 tools" }, undefined, { grep: STUB_GREP_ERROR });
    expect(backup.code).toBe(2);
  });

  it("fails a backup that exits 0 without writing the backup file", () => {
    const r = runStep("backup", { STUB_OUTPUT: "backup: wrote x: 14 tools, 3 tool_links, 9 tool_metrics_history row(s)" });
    expect(r.code).toBe(1);
  });

  it("summarises mode, outcomes and counts with no fingerprint or file path", () => {
    const backup = runStep("backup", {
      STUB_BACKUP: "{}",
      STUB_OUTPUT: "using DATABASE_URL (NODE_ENV=production), database sha256:0123456789abcdef\nbackup: wrote /tmp/runner/d90-backup.json: 14 tools, 3 tool_links, 9 tool_metrics_history row(s)",
    });
    expect(backup.code).toBe(0);
    const s = runStep(
      "summary",
      { MODE: "apply", DRY_RUN_OUTCOME: "success", BACKUP_OUTCOME: "success", APPLY_OUTCOME: "failure" },
      backup.dir
    );
    expect(s.code).toBe(0);
    const summary = s.read("summary.md");
    expect(summary).toContain("- Mode: apply");
    expect(summary).toContain("- Apply: failure");
    expect(summary).toContain("backup: 14 tools, 3 tool_links, 9 tool_metrics_history row(s)");
    expect(summary).not.toMatch(/sha256:|d90-backup\.json|DATABASE_URL/);
  });
});
