import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * #231 — the changelog generator dates entries correctly on full and shallow clones.
 *
 * Why: The sync test copies committed dates, so it cannot catch a wrong date.
 * A shallow clone (Vercel's git builds) made blame charge every older line to
 * the boundary commit, and the generator labelled those dates "commit".
 * What: Builds a fixture git repo with one commit per [Unreleased] bullet at
 * known committer times, runs `scripts/generate-changelog-data.ts --root` on
 * it, then on a `--depth=3` clone of it, with and without the committed data.
 * Test: `npx vitest run tests/unit/generate-changelog-script-231.test.ts`.
 * Local git and the repo's tsx only; no network.
 */

const projectRoot = join(__dirname, "..", "..");
const tsx = join(projectRoot, "node_modules", ".bin", "tsx");
const script = join(projectRoot, "scripts", "generate-changelog-data.ts");
const DATA = join("data", "changelog-entries.generated.json");
const BASE = 1_700_000_000;
const DAY = 86_400;
const BULLETS = 6;

/** Environment without inherited GIT_* variables, so git acts on the fixture. */
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

function git(cwd: string, args: string[], time?: number): string {
  const stamp = time === undefined ? {} : { GIT_AUTHOR_DATE: `@${time} +0000`, GIT_COMMITTER_DATE: `@${time} +0000` };
  const res = spawnSync(
    "git",
    ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8", env: { ...cleanEnv, ...stamp } }
  );
  if (res.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${res.stderr}`);
  return res.stdout;
}

function generate(root: string) {
  const res = spawnSync(tsx, [script, "--root", root], { cwd: projectRoot, encoding: "utf8", env: cleanEnv });
  return { status: res.status, stderr: res.stderr, data: readFileSync(join(root, DATA), "utf8") };
}

type Entry = { version: string; title: string; date: string; dateSource: string };
const unreleased = (data: string) =>
  (JSON.parse(data) as Entry[]).filter((e) => e.version === "Unreleased").sort((a, b) => a.title.localeCompare(b.title));
const iso = (k: number) => new Date((BASE + k * DAY) * 1000).toISOString();

let dir: string;
let repo: string;
/** The full-clone run, whose output the fixture commits as its data. */
let fullRun: ReturnType<typeof generate>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "changelog-script-231-"));
  repo = join(dir, "full");
  spawnSync("git", ["init", "-q", repo], { env: cleanEnv });
  const changelog = join(repo, "CHANGELOG.md");
  writeFileSync(changelog, "# Changelog\n\n## [Unreleased]\n\n### Fixed\n");
  // Commit k adds bullet k at committer time BASE + k days. Bullets are
  // prepended so each commit leaves the earlier lines untouched in blame.
  for (let k = 1; k <= BULLETS; k++) {
    const text = readFileSync(changelog, "utf8").replace("### Fixed\n", `### Fixed\n- fix(x): change ${k}\n`);
    writeFileSync(changelog, k === 1 ? `${text}\n## [1.0.0] - 2023-01-02\n\n### Added\n- feat(x): released\n` : text);
    git(repo, ["add", "-A"]);
    git(repo, ["commit", "-q", "-m", `change ${k}`], BASE + k * DAY);
  }
  // Generate on the full repo and commit the data, as a developer would.
  fullRun = generate(repo);
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "data"], BASE + 10 * DAY);
}, 60_000);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("generate-changelog-data on a fixture repo (#231)", () => {
  it("dates every [Unreleased] line by its own commit on a full clone", () => {
    expect(fullRun.status).toBe(0);
    expect(fullRun.stderr).not.toMatch(/shallow/);
    expect(unreleased(fullRun.data).map((e) => [e.title, e.date, e.dateSource])).toEqual(
      Array.from({ length: BULLETS }, (_, i) => [`change ${i + 1}`, iso(i + 1), "commit"])
    );
  });

  it("keeps the committed dates on a shallow clone, byte for byte, and warns", () => {
    const committed = fullRun.data;

    // Depth 3 fetches the data commit and changes 6 and 5; change 5 is the boundary.
    const shallow = join(dir, "shallow");
    git(dir, ["clone", "-q", "--depth=3", `file://${repo}`, shallow]);
    expect(git(shallow, ["rev-parse", "--is-shallow-repository"]).trim()).toBe("true");

    const run = generate(shallow);
    expect(run.status).toBe(0);
    expect(run.stderr).toMatch(/shallow clone/);
    expect(run.data).toBe(committed);
  }, 60_000);

  it("never labels a boundary line 'commit' on a shallow clone with no previous data", () => {
    const shallow = join(dir, "shallow-bare");
    git(dir, ["clone", "-q", "--depth=3", `file://${repo}`, shallow]);
    unlinkSync(join(shallow, DATA));

    const entries = unreleased(generate(shallow).data);
    // Change 6 lies inside the fetched history; changes 1-5 sit on or behind the boundary.
    expect(entries[5]).toMatchObject({ title: "change 6", date: iso(6), dateSource: "commit" });
    for (const entry of entries.slice(0, 5)) {
      expect(entry.dateSource, entry.title).toBe("build");
      expect(entry.date, entry.title).not.toBe(iso(5));
    }
  }, 60_000);
});
