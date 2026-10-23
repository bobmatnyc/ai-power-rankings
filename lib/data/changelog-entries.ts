/**
 * Platform changelog entries, compiled from CHANGELOG.md at build time (#231).
 *
 * Why: The deploy did not ship CHANGELOG.md, so runtime reads of it found
 * nothing (#231). The runtime imports this data instead of reading a file.
 * What: Types and re-exports `data/changelog-entries.generated.json`, which
 * `npm run generate-changelog` writes. Entries are in CHANGELOG order,
 * `[Unreleased]` first.
 * Test: `tests/unit/changelog-generated-sync.test.ts`.
 */

import type { ChangelogEntry } from "./changelog-generator";
import generated from "../../data/changelog-entries.generated.json";

export const CHANGELOG_ENTRIES: readonly ChangelogEntry[] = generated as ChangelogEntry[];
