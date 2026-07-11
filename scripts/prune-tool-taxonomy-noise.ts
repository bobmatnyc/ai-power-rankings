#!/usr/bin/env node

/**
 * Prune tool-taxonomy noise + dedupe (issue #80)
 *
 * Removes auto-created scope noise the owner chose to prune and resolves three
 * known duplicate pairs. Companion to the createAutoTool() gating in
 * lib/db/repositories/articles/articles-entities.service.ts (issue #79), which
 * prevents this noise from regrowing.
 *
 * Deletion set (bounded):
 *   - Every tool in category `llm` or `chat` (auto-created scope noise), EXCEPT
 *     any that appear in the current (is_current = true) ranking snapshot.
 *   - The garbage entity `anthropic-s-claude-agent` ("Anthropic's Claude Agent").
 *   - Three duplicate pairs — KEEP the row in the live ranking (or the
 *     older/more-complete row if neither is ranked), DELETE the other:
 *       keep gemini-code-assist        / delete google-gemini-code-assist
 *       keep google-jules OR jules     / delete the other (ranked wins)
 *       keep jetbrains-ai OR ...-ai-assistant / delete the other (ranked wins)
 *
 * Safety:
 *   - Dry-run by DEFAULT. Requires --execute to mutate anything.
 *   - NEVER deletes a tool that appears in the current ranking snapshot. Such a
 *     candidate is SKIPPED and flagged in the report.
 *   - On --execute, writes a full-row JSON backup of every row to be deleted to
 *     data/backups/tools-prune-<timestamp>.json BEFORE deleting.
 *   - For duplicate deletions, re-points article_rankings_changes.tool_id
 *     references from the deleted row to the kept row before deleting.
 *
 * Usage:
 *   npx tsx scripts/prune-tool-taxonomy-noise.ts            # dry-run
 *   npx tsx scripts/prune-tool-taxonomy-noise.ts --execute  # perform deletion
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq, inArray, or } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db/connection";
import { articleRankingsChanges } from "@/lib/db/article-schema";
import { rankings, tools, type Tool } from "@/lib/db/schema";

// Categories treated as auto-created scope noise (whole-category prune).
const NOISE_CATEGORIES = ["llm", "chat"] as const;

// Explicit garbage entity fragment (also caught by the createAutoTool blocklist).
const GARBAGE_SLUGS = ["anthropic-s-claude-agent"] as const;

// Known duplicate pairs. `keep`/`other` are the two candidate slugs; the kept
// row is resolved at runtime: the one in the current ranking wins, else the
// older/more-complete row. The non-kept row is deleted.
const DUPLICATE_PAIRS: Array<{ a: string; b: string }> = [
  { a: "gemini-code-assist", b: "google-gemini-code-assist" },
  { a: "google-jules", b: "jules" },
  { a: "jetbrains-ai", b: "jetbrains-ai-assistant" },
];

interface RankInfo {
  slugs: Set<string>;
  toolIds: Set<string>;
}

async function loadCurrentRankingInfo(db: NonNullable<ReturnType<typeof getDb>>): Promise<RankInfo> {
  const cur = await db.select().from(rankings).where(eq(rankings.isCurrent, true)).limit(1);
  const slugs = new Set<string>();
  const toolIds = new Set<string>();
  if (cur.length) {
    const data = cur[0].data as unknown;
    if (Array.isArray(data)) {
      for (const entry of data as Array<Record<string, unknown>>) {
        const slug = (entry.tool_slug ?? (entry.tool as Record<string, unknown>)?.slug ?? entry.slug) as
          | string
          | undefined;
        const toolId = (entry.tool_id ?? (entry.tool as Record<string, unknown>)?.id) as string | undefined;
        if (slug) slugs.add(slug);
        if (toolId) toolIds.add(toolId);
      }
    }
  }
  return { slugs, toolIds };
}

/** Resolve which row of a duplicate pair to keep. Ranked wins; else older/more-complete. */
function resolveKeep(a: Tool | undefined, b: Tool | undefined, ranked: Set<string>): {
  keep?: Tool;
  del?: Tool;
} {
  if (a && !b) return { keep: a };
  if (b && !a) return { keep: b };
  if (!a && !b) return {};
  const ra = ranked.has(a!.slug);
  const rb = ranked.has(b!.slug);
  if (ra && !rb) return { keep: a, del: b };
  if (rb && !ra) return { keep: b, del: a };
  // Neither (or both) ranked: keep older; tie-break on having a companyId.
  const aScore = (a!.companyId ? 1 : 0);
  const bScore = (b!.companyId ? 1 : 0);
  const aOlder = new Date(a!.createdAt).getTime() <= new Date(b!.createdAt).getTime();
  const keepA = aScore !== bScore ? aScore > bScore : aOlder;
  return keepA ? { keep: a, del: b } : { keep: b, del: a };
}

function fmtRow(t: Tool, ranked: boolean): string {
  const created = t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt);
  return `  - ${t.slug}  |  ${t.name}  |  cat=${t.category}  |  created=${created}  |  inRanking=${ranked ? "YES" : "no"}`;
}

async function main(execute: boolean): Promise<void> {
  console.log("Prune tool-taxonomy noise + dedupe (issue #80)");
  console.log(execute ? "MODE: EXECUTE (destructive)" : "MODE: DRY-RUN (no changes)");
  console.log("=".repeat(80) + "\n");

  const db = getDb();
  if (!db) throw new Error("Failed to get database connection");

  const ranking = await loadCurrentRankingInfo(db);
  console.log(`Current ranking: ${ranking.slugs.size} tool slugs (protected from deletion)\n`);

  const allTools = await db.select().from(tools);
  const bySlug = new Map(allTools.map((t) => [t.slug, t]));

  // 1) Whole-category noise + garbage entities.
  const noiseTools = allTools.filter(
    (t) => (NOISE_CATEGORIES as readonly string[]).includes(t.category) || (GARBAGE_SLUGS as readonly string[]).includes(t.slug)
  );

  // 2) Duplicate resolution -> deletions + re-point map (deletedId -> keptId).
  const dupDeletes: Tool[] = [];
  const repoint: Array<{ del: Tool; keep: Tool }> = [];
  console.log("Duplicate pair resolution:");
  for (const pair of DUPLICATE_PAIRS) {
    const { keep, del } = resolveKeep(bySlug.get(pair.a), bySlug.get(pair.b), ranking.slugs);
    if (!keep && !del) {
      console.log(`  - ${pair.a} / ${pair.b}: neither present, skipping`);
      continue;
    }
    if (keep && !del) {
      console.log(`  - ${pair.a} / ${pair.b}: only "${keep.slug}" present, nothing to delete`);
      continue;
    }
    console.log(
      `  - KEEP ${keep!.slug} (${ranking.slugs.has(keep!.slug) ? "ranked" : "unranked"}) | DELETE ${del!.slug}`
    );
    dupDeletes.push(del!);
    repoint.push({ del: del!, keep: keep! });
  }
  console.log("");

  // Union of all deletion candidates (dedupe by id).
  const candidateMap = new Map<string, Tool>();
  for (const t of [...noiseTools, ...dupDeletes]) candidateMap.set(t.id, t);
  const candidates = [...candidateMap.values()];

  // 3) SAFETY: never delete a tool in the current ranking.
  const toDelete: Tool[] = [];
  const skipped: Tool[] = [];
  for (const t of candidates) {
    if (ranking.slugs.has(t.slug) || ranking.toolIds.has(t.id)) skipped.push(t);
    else toDelete.push(t);
  }

  toDelete.sort((x, y) => x.category.localeCompare(y.category) || x.slug.localeCompare(y.slug));

  console.log(`Candidates: ${candidates.length}  |  To delete: ${toDelete.length}  |  Skipped (in ranking): ${skipped.length}\n`);

  console.log("TOOLS THAT WOULD BE DELETED:");
  if (toDelete.length === 0) console.log("  (none)");
  for (const t of toDelete) console.log(fmtRow(t, ranking.slugs.has(t.slug)));
  console.log("");

  if (skipped.length) {
    console.log("SKIPPED — in current ranking, NOT deleted (flagged):");
    for (const t of skipped) console.log(fmtRow(t, true));
    console.log("");
  }

  if (!execute) {
    console.log("=".repeat(80));
    console.log("DRY-RUN complete. Re-run with --execute to delete and write a backup.");
    await closeDb();
    return;
  }

  if (toDelete.length === 0) {
    console.log("Nothing to delete. Exiting without changes.");
    await closeDb();
    return;
  }

  // 4) BACKUP before any mutation.
  const backupDir = join(process.cwd(), "data", "backups");
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `tools-prune-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), count: toDelete.length, tools: toDelete },
      null,
      2
    )
  );
  console.log(`Backup written: ${backupPath} (${toDelete.length} rows)\n`);

  // 5) Re-point FK-style references for duplicate deletions before deleting.
  const deletedIds = new Set(toDelete.map((t) => t.id));
  for (const { del, keep } of repoint) {
    if (!deletedIds.has(del.id)) continue; // was skipped as ranked
    const updated = await db
      .update(articleRankingsChanges)
      .set({ toolId: keep.id })
      .where(or(eq(articleRankingsChanges.toolId, del.id), eq(articleRankingsChanges.toolId, del.slug)))
      .returning({ id: articleRankingsChanges.id });
    console.log(
      `Re-pointed ${updated.length} article_rankings_changes row(s) from ${del.slug} -> ${keep.slug}`
    );
  }
  console.log("");

  // 6) DELETE.
  const deleted = await db
    .delete(tools)
    .where(inArray(tools.id, [...deletedIds]))
    .returning({ id: tools.id, slug: tools.slug, name: tools.name, category: tools.category });

  console.log(`DELETED ${deleted.length} tools:`);
  for (const d of deleted) console.log(`  x ${d.slug}  |  ${d.name}  |  cat=${d.category}`);
  console.log("");

  // 7) Verify.
  const remaining = await db.select({ slug: tools.slug }).from(tools).where(inArray(tools.id, [...deletedIds]));
  if (remaining.length === 0) console.log("Verification: all targeted rows removed.");
  else console.log(`WARNING: ${remaining.length} targeted rows still present: ${remaining.map((r) => r.slug).join(", ")}`);

  console.log(`\nBackup: ${backupPath}`);
  await closeDb();
}

const execute = process.argv.slice(2).some((a) => a === "--execute" || a === "-e");
main(execute)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
