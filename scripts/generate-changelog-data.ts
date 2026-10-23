#!/usr/bin/env tsx
/**
 * Generate Changelog Data — CLI entry (#231)
 *
 * Why: The deploy did not ship CHANGELOG.md, so every runtime read of it found
 * nothing and the platform feed was silently empty (#231). This script runs
 * first in `npm run build` and turns CHANGELOG.md into
 * `data/changelog-entries.generated.json`, which the runtime imports through
 * `lib/data/changelog-entries.ts`.
 * What: Reads CHANGELOG.md (exit 1 when it is missing), dates each
 * `[Unreleased]` line from `git blame` when git is available, reuses the
 * previous data's dates otherwise, and falls back to the build date. Refuses
 * (exit 1) to write data with no entries. Writes atomically.
 * Test: `tests/unit/changelog-generated-sync.test.ts` covers the core in
 * `lib/data/changelog-generator.ts` and fails when the committed data is
 * stale; this entry point only wires filesystem and git access.
 *
 * Usage:
 *   npm run generate-changelog
 */

import { spawnSync } from "child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import {
  buildEntries,
  dateResolver,
  GENERATED_RELATIVE_PATH,
  parseBlamePorcelain,
  parseChangelog,
  renderData,
  type ChangelogEntry,
  type ResolvedDate,
} from "../lib/data/changelog-generator";

const root = join(__dirname, "..");

function previousDates(target: string): Map<string, ResolvedDate> {
  if (!existsSync(target)) return new Map();
  try {
    const entries = JSON.parse(readFileSync(target, "utf8")) as ChangelogEntry[];
    return new Map(entries.map((e) => [e.id, { date: e.date, dateSource: e.dateSource }]));
  } catch {
    console.warn("generate-changelog: previous data unreadable; not reusing its dates.");
    return new Map();
  }
}

function blame(): Map<number, number | null> | null {
  const res = spawnSync("git", ["blame", "--line-porcelain", "--", "CHANGELOG.md"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    console.warn("generate-changelog: git blame unavailable; reusing previous dates or the build date.");
    return null;
  }
  return parseBlamePorcelain(res.stdout);
}

async function main(): Promise<number> {
  const changelogPath = join(root, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    console.error("generate-changelog: CHANGELOG.md not found; refusing to write an empty feed.");
    return 1;
  }

  const target = join(root, GENERATED_RELATIVE_PATH);
  const bullets = parseChangelog(readFileSync(changelogPath, "utf8"));
  const entries = buildEntries(
    bullets,
    dateResolver({ blame: blame(), previous: previousDates(target), buildDate: new Date() })
  );
  if (entries.length === 0) {
    console.error("generate-changelog: CHANGELOG.md has no change entries; refusing to write.");
    return 1;
  }

  const temp = `${target}.tmp`;
  writeFileSync(temp, renderData(entries));
  renameSync(temp, target);

  const bySource = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.dateSource] = (acc[e.dateSource] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`generate-changelog: wrote ${entries.length} entries to ${GENERATED_RELATIVE_PATH}`, bySource);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error("generate-changelog: failed:", error);
    process.exit(1);
  }
);
