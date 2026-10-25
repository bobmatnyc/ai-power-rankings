/**
 * Guards on the manual rankings publish workflow (#101, Bob D24).
 *
 * Why: `.github/workflows/publish-rankings.yml` calls the production publish
 * route, which has no dry-run mode, from a public repository. A schedule or
 * push trigger, a missing confirm guard, an automatic retry or a secret in
 * `run:` text would each publish without clearance, publish twice or leak the
 * secret.
 * What: reads the workflow as text and checks: `workflow_dispatch` is the only
 * trigger; `confirm` is required and compared with `publish-v${EXPECTED_VERSION}`
 * (#185: the workflow's EXPECTED_VERSION is 8.0 after v8 activation); concurrency
 * never cancels a running publish; permissions are `contents: read`; the secret
 * appears only as an `env:` value and is sent with `--header @-`; there is no
 * `set -x`; curl runs with `--retry 0` and no retry loop. It also extracts
 * the publish step's `run:` script and runs it under bash with a stub `curl`
 * first on PATH and a dummy secret: each HTTP outcome maps to its exit code,
 * the header arrives on stdin with `--proto =https`, and an origin other than
 * aipowerranking.com exits 1 before any curl call. #185: the confirm step also
 * runs under bash: publish-v8.0 passes, publish-v7.10 and an unset version stop it;
 * a 200 with 8.0 exits 0 and a 200 with any other version exits 4 with the
 * "row was replaced" message.
 * Test: `npx vitest run tests/unit/publish-rankings-workflow-101.test.ts`. It
 * fails where the workflow file does not exist. Needs `bash` and `jq` on PATH.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const WORKFLOW = join(process.cwd(), ".github/workflows/publish-rankings.yml");

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
  expect(start, "top-level `on:` block").toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\S/.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

describe("publish-rankings workflow (#101)", () => {
  it("is triggered by workflow_dispatch only", () => {
    const triggers = onBlock(load())
      .filter((line) => /^ {2}\S/.test(line))
      .map((line) => line.trim().replace(/:.*$/, ""));
    expect(triggers).toEqual(["workflow_dispatch"]);
    for (const banned of ["schedule", "push", "pull_request", "workflow_call", "repository_dispatch"]) {
      expect(onBlock(load()).join("\n")).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });

  // #185: was "refuses anything but publish-v7.10"; the confirm string now follows EXPECTED_VERSION.
  it("requires the confirm input and refuses anything but publish-v<EXPECTED_VERSION>, which is 8.0", () => {
    const text = codeLines(load()).join("\n");
    expect(text).toMatch(/\n {6}confirm:\n(?: {8}.*\n)*? {8}required: true/);
    expect(text).toContain("CONFIRM: ${{ inputs.confirm }}");
    expect(text).toMatch(/if \[ "\$CONFIRM" != "publish-v\$\{EXPECTED_VERSION\}" \]; then/);
    expect(expectedVersion()).toBe("8.0");
  });

  it("never cancels a running publish and reads contents only", () => {
    const text = codeLines(load()).join("\n");
    expect(text).toMatch(/\nconcurrency:\n {2}group: \S+\n {2}cancel-in-progress: false\n/);
    expect(text).toMatch(/\npermissions:\n {2}contents: read\n/);
  });

  it("passes the secret through env only and never puts it in a run line or curl args", () => {
    const lines = codeLines(load());
    const secretLines = lines.filter((line) => line.includes("secrets."));
    expect(secretLines).toEqual(["          CRON_SECRET: ${{ secrets.CRON_SECRET }}"]);
    const text = lines.join("\n");
    expect(text).not.toMatch(/-H\s+["']?Authorization/i);
    expect(text).not.toMatch(/--header\s+["']Authorization/i);
    expect(text).toContain("--header @-");
    expect(text).not.toMatch(/\bset -[a-z]*x/);
    expect(text).not.toMatch(/echo[^\n]*\$\{?CRON_SECRET/);
  });

  it("sends one request with no automatic retry", () => {
    // Join shell line continuations so each curl call is one line.
    const text = codeLines(load()).join("\n").replace(/\\\n\s*/g, " ");
    const publishCurls = text.match(/\bcurl\b[^\n]*/g) ?? [];
    expect(publishCurls.length).toBeGreaterThan(0);
    for (const call of publishCurls) {
      expect(call).toContain("--retry 0");
      expect(call).not.toMatch(/--retry(?!\s+0\b)/);
    }
    // No shell loop of any kind (while, until or for) around the request.
    expect(text).not.toMatch(/;\s*do\s*$/m);
    expect(text).not.toMatch(/^\s*do\s*$/m);
    expect(text).toContain("PUBLISH_TIMEOUT_SECONDS: '310'");
  });
});

/**
 * The literal block of the step whose `id:` is `stepId`, de-indented.
 * Text-based so the test needs no YAML dependency; the block ends at the first
 * non-blank line indented no deeper than its `run: |` key.
 */
function stepRunScript(text: string, stepId: string): string {
  const lines = text.split("\n");
  const idAt = lines.findIndex((line) => line.trim() === `id: ${stepId}`);
  expect(idAt, `step id ${stepId}`).toBeGreaterThanOrEqual(0);
  const runAt = lines.findIndex((line, i) => i > idAt && /^\s+run: \|\s*$/.test(line));
  expect(runAt, `run block of ${stepId}`).toBeGreaterThan(idAt);
  const keyIndent = lines[runAt]!.search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(runAt + 1)) {
    if (line.trim() !== "" && line.search(/\S/) <= keyIndent) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter((l) => l.trim() !== "").map((l) => l.search(/\S/)));
  return `${body.map((l) => l.slice(indent)).join("\n")}\n`;
}

const DUMMY_SECRET = "dummy-secret-101-not-real";

/** #185: the workflow-level EXPECTED_VERSION, read from the file so the tests follow it. */
function expectedVersion(): string {
  const match = /^ {2}EXPECTED_VERSION: '([^']+)'$/m.exec(load());
  expect(match, "workflow env EXPECTED_VERSION").not.toBeNull();
  return match![1]!;
}

/** #185: runs the confirm step's script with `confirm` and the workflow's EXPECTED_VERSION. */
function runConfirm(confirm: string, version: string | null = expectedVersion()): { code: number | null; output: string } {
  const dir = mkdtempSync(join(tmpdir(), "confirm-185-"));
  tempDirs.push(dir);
  const script = join(dir, "confirm.sh");
  writeFileSync(script, stepRunScript(load(), "confirm"));
  const env: Record<string, string> = { PATH: process.env["PATH"] ?? "", CONFIRM: confirm };
  if (version !== null) env["EXPECTED_VERSION"] = version;
  const res = spawnSync("bash", [script], { encoding: "utf8", input: "", env });
  return { code: res.status, output: `${res.stdout}${res.stderr}` };
}

// Records each call's args and stdin, writes STUB_BODY to the `-o` file and
// prints STUB_STATUS as `-w '%{http_code}'` would. STUB_STATUS=none mimics a
// timeout: curl prints 000 and exits 28.
const STUB_CURL = `#!/bin/bash
printf '%s\\n' "$*" >> "$STUB_LOG"
cat > "$STUB_STDIN"
out=""
while [ $# -gt 0 ]; do
  if [ "$1" = "-o" ]; then out="$2"; shift; fi
  shift
done
if [ "$STUB_STATUS" = "none" ]; then
  echo "curl: (28) Operation timed out" >&2
  printf '000'
  exit 28
fi
printf '%s' "$STUB_BODY" > "$out"
printf '%s' "$STUB_STATUS"
`;

interface StubRun {
  code: number | null;
  output: string;
  calls: string[];
  stdin: string;
}

const tempDirs: string[] = [];

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function runPublish(opts: { status: string; body?: unknown; origin?: string }): StubRun {
  const dir = mkdtempSync(join(tmpdir(), "publish-101-"));
  tempDirs.push(dir);
  const script = join(dir, "publish.sh");
  writeFileSync(script, stepRunScript(load(), "publish"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "curl"), STUB_CURL);
  chmodSync(join(bin, "curl"), 0o755);
  const log = join(dir, "calls.log");
  const stdin = join(dir, "stdin.txt");
  const summary = join(dir, "summary.md");
  const res = spawnSync("bash", [script], {
    encoding: "utf8",
    input: "",
    env: {
      PATH: `${bin}:${process.env["PATH"] ?? ""}`,
      CRON_SECRET: DUMMY_SECRET,
      PRODUCTION_BASE_URL: opts.origin ?? "https://aipowerranking.com",
      PUBLISH_TIMEOUT_SECONDS: "310",
      EXPECTED_VERSION: expectedVersion(),
      RUNNER_TEMP: dir,
      GITHUB_STEP_SUMMARY: summary,
      STUB_LOG: log,
      STUB_STDIN: stdin,
      STUB_STATUS: opts.status,
      STUB_BODY: JSON.stringify(opts.body ?? {}),
    },
  });
  return {
    code: res.status,
    output: `${res.stdout}${res.stderr}${readIfExists(summary)}`,
    calls: readIfExists(log).split("\n").filter(Boolean),
    stdin: readIfExists(stdin),
  };
}

/** One request, header on stdin, https only, secret never in args or output. */
function expectOneSafeCall(run: StubRun): void {
  expect(run.calls).toHaveLength(1);
  const args = run.calls[0]!;
  expect(args).toContain("--proto =https");
  expect(args).toContain("--retry 0");
  expect(args).toContain("--max-time 310");
  expect(args).toContain("--header @-");
  expect(args).toContain("https://aipowerranking.com/api/cron/regenerate-rankings");
  expect(args).not.toContain(DUMMY_SECRET);
  expect(run.stdin).toBe(`Authorization: Bearer ${DUMMY_SECRET}\n`);
  expect(run.output).not.toContain(DUMMY_SECRET);
}

describe("publish-rankings publish step under a stub curl (#101)", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("runs the confirm step before the publish step", () => {
    const lines = load().split("\n");
    const confirmAt = lines.findIndex((l) => l.trim() === "- name: Require confirmation");
    const publishAt = lines.findIndex((l) => l.trim() === "id: publish");
    expect(confirmAt).toBeGreaterThanOrEqual(0);
    expect(publishAt).toBeGreaterThan(confirmAt);
  });

  // #185: was "200 with 7.10 exits 0"; a v8 publish reports 8.0.
  it("200 with 8.0 exits 0 and prints only the three fields", () => {
    const run = runPublish({
      status: "200",
      body: { period: "2026-11", algorithm_version: "8.0", tool_count: 51, top_movers: [{ slug: "LEAK" }] },
    });
    expect(run.code).toBe(0);
    expectOneSafeCall(run);
    expect(run.output).toContain("algorithm_version: 8.0");
    expect(run.output).toContain("Result: published v8.0");
    expect(run.output).not.toContain("LEAK");
  });

  // #185: was "200 with 7.9"; 7.10 is now the mismatch a stale deploy would report.
  it.each(["7.10", "7.9"])("200 with %s exits 4 and says the row WAS published", (version) => {
    const run = runPublish({
      status: "200",
      body: { period: "2026-11", algorithm_version: version, tool_count: 51 },
    });
    expect(run.code).toBe(4);
    expectOneSafeCall(run);
    expect(run.output).toContain(
      `PUBLISHED with algorithm_version ${version}, not v8.0. The current row was replaced. Do not re-dispatch; report to Architect.`
    );
  });

  it("the confirm step passes publish-v8.0 and stops publish-v7.10, an empty value and an unset version", () => {
    expect(runConfirm("publish-v8.0").code).toBe(0);
    for (const confirm of ["publish-v7.10", "", "publish-v8.0 "]) {
      const run = runConfirm(confirm);
      expect(run.code, confirm).toBe(1);
      expect(run.output).toContain("confirm must equal publish-v8.0; nothing was published");
    }
    expect(runConfirm("publish-v8.0", null).code).not.toBe(0);
  });

  it("401 exits 2", () => {
    const run = runPublish({ status: "401", body: { error: "Unauthorized" } });
    expect(run.code).toBe(2);
    expectOneSafeCall(run);
  });

  it("409 exits 3", () => {
    const run = runPublish({ status: "409", body: { error: "in progress" } });
    expect(run.code).toBe(3);
    expectOneSafeCall(run);
  });

  it("500 exits 1 without printing the body", () => {
    const run = runPublish({ status: "500", body: { details: "LEAK stack" } });
    expect(run.code).toBe(1);
    expectOneSafeCall(run);
    expect(run.output).not.toContain("LEAK");
  });

  it("no response exits 1", () => {
    const run = runPublish({ status: "none" });
    expect(run.code).toBe(1);
    expectOneSafeCall(run);
    expect(run.output).toContain("HTTP status: 000");
  });

  it.each([
    "https://evil.example.com",
    "https://aipowerranking.com.evil.example",
    "http://aipowerranking.com",
    "https://aipowerranking.com/other",
  ])("origin %s exits 1 with zero curl calls", (origin) => {
    const run = runPublish({ status: "200", body: { algorithm_version: "8.0" }, origin });
    expect(run.code).toBe(1);
    expect(run.calls).toHaveLength(0);
    expect(run.output).not.toContain(DUMMY_SECRET);
  });
});
