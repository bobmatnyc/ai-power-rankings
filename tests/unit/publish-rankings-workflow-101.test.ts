/**
 * Guards on the manual rankings publish workflow (#101, Bob D24).
 *
 * Why: `.github/workflows/publish-rankings.yml` calls the production publish
 * route, which has no dry-run mode, from a public repository. A schedule or
 * push trigger, a missing confirm guard, an automatic retry or a secret in
 * `run:` text would each publish without clearance, publish twice or leak the
 * secret.
 * What: reads the workflow as text and checks: `workflow_dispatch` is the only
 * trigger; `confirm` is required and compared with `publish-v7.10`; concurrency
 * never cancels a running publish; permissions are `contents: read`; the secret
 * appears only as an `env:` value and is sent with `--header @-`; there is no
 * `set -x`; curl runs with `--retry 0` and no retry loop.
 * Test: `npx vitest run tests/unit/publish-rankings-workflow-101.test.ts`. It
 * fails where the workflow file does not exist.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("requires the confirm input and refuses anything but publish-v7.10", () => {
    const text = codeLines(load()).join("\n");
    expect(text).toMatch(/\n {6}confirm:\n(?: {8}.*\n)*? {8}required: true/);
    expect(text).toContain("CONFIRM: ${{ inputs.confirm }}");
    expect(text).toMatch(/if \[ "\$CONFIRM" != "publish-v7\.10" \]; then/);
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
