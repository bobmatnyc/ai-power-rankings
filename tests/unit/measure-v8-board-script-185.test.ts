import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { assertSelectOnly } from "../../lib/ranking-snapshot-diff";

/**
 * #185 — the v8 measurement script stays local, read-only and quiet.
 *
 * Why: the script reads production with a credential and is the D45 proof.
 *   It must never run in GitHub Actions (public logs), send anything but two
 *   SELECTs in a READ ONLY transaction, or print a database error's text.
 * What: runs the script with tsx and no database variable, once with
 *   GITHUB_ACTIONS=true (refused, exit 2) and once without (exit 1 with the
 *   script's own message, after the profiles load). Then checks the source's
 *   statements and that no workflow or the local gate names the script.
 * Test: `npx vitest run tests/unit/measure-v8-board-script-185.test.ts`
 */

const root = join(__dirname, "..", "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const script = join(root, "scripts", "measure-v8-board.ts");
const source = readFileSync(script, "utf8");

const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !["DATABASE_URL", "CI", "GITHUB_ACTIONS"].includes(key))
);

function run(env: Record<string, string | undefined>) {
  const res = spawnSync(tsx, [script], { cwd: root, encoding: "utf8", env });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe("measure-v8-board script (#185)", () => {
  it("refuses to run under GitHub Actions before touching anything", () => {
    const res = run({ ...baseEnv, GITHUB_ACTIONS: "true" });
    expect(res.status).toBe(2);
    expect(res.stdout).toBe("");
    expect(res.stderr).toMatch(/refused, it never runs under CI/);
  }, 30_000);

  it("refuses under any CI flag", () => {
    expect(run({ ...baseEnv, CI: "1" }).status).toBe(2);
  }, 30_000);

  it("without a database variable exits 1 with its own message and no report", () => {
    const res = run(baseEnv);
    expect(res.status).toBe(1);
    expect(res.stdout).toBe("Result: ERROR\n");
    expect(res.stderr).toBe("measure-v8-board failed: the database connection variable is not set\n");
  }, 30_000);

  it("sends only single SELECTs on tools and rankings, in a READ ONLY transaction", () => {
    const statements = [...source.matchAll(/"(SELECT [^"]+)"/g)].map((m) => m[1]!);
    expect(statements).toHaveLength(2);
    for (const statement of statements) expect(() => assertSelectOnly(statement)).not.toThrow();
    expect(statements.map((s) => /\bFROM (\w+)/.exec(s)![1])).toEqual(["tools", "rankings"]);
    expect(source).toMatch(/\{ readOnly: true \}/);
    expect(source).not.toMatch(/getDb\(|dotenv|["'][^"'\s]*\.env/);
  });

  it("is not run by any workflow or by the local gate", () => {
    const dir = join(root, ".github", "workflows");
    for (const file of readdirSync(dir)) {
      expect(readFileSync(join(dir, file), "utf8")).not.toContain("measure-v8-board");
    }
    expect(readFileSync(join(root, "scripts", "local-gate.mjs"), "utf8")).not.toContain("measure-v8-board");
    expect(readFileSync(join(root, "package.json"), "utf8")).not.toContain("measure-v8-board");
  });
});
