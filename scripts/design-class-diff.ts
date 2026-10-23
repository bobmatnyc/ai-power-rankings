#!/usr/bin/env tsx
/**
 * Class-diff check for #190 colour migrations on pages that cannot be
 * screenshotted (ruling D1: admin and auth).
 *
 * Why: a migration PR on those pages has no before/after screenshots, so it
 * must prove from source that the only change is old colour → mapped token.
 * What: for each file in the set (or the files given), compares the file at
 * `--base` (default `origin/main`) with the working tree. Comments are
 * stripped from both sides; the rest is diffed by line, and each changed
 * block is split into tokens (whitespace, quotes, braces, parentheses, commas
 * and semicolons separate them, so a reflowed line still compares). The
 * block passes only when the old tokens turn into the new ones through equal
 * tokens and table substitutions from `scripts/design-class-maps.ts`:
 * a palette class to its token class with the same variant prefix and
 * opacity modifier, a light/`dark:` pair to its one token, or an inline hex
 * to its `hsl(var(--ds-…))`. Anything else fails: another class, a dropped
 * or changed variant, a non-colour class change, or a code change.
 * Exit 0 when every file passes, 1 otherwise. It prints the substitution
 * count per table entry.
 * Test: `tests/unit/design-parity-190e2a.test.ts` runs `diffSource` on
 * passing and failing samples; `npx tsx scripts/design-class-diff.ts --set
 * 190e2a` checks the branch.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLASS_MAPS, type ClassMap } from "./design-class-maps";

const ROOT = join(__dirname, "..");

/** Removes block and line comments, keeping line breaks so line numbers hold. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Splits code into tokens; whitespace separates and is dropped. */
export function tokenize(code: string): string[] {
  return code.match(/[^\s"'`{}(),;]+|["'`{}(),;]/g) ?? [];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** A step that turns old tokens at `i` into new tokens at `j`, or null. */
type Rule = (removed: string[], i: number, added: string[], j: number) => { di: number; dj: number } | null;

interface NamedRule {
  key: string;
  apply: Rule;
}

function startsWith(tokens: string[], at: number, wanted: string[]): boolean {
  return wanted.every((token, k) => tokens[at + k] === token);
}

/** True when the class string holding `tokens[at]` also has a `dark:<utility>-` class. */
function hasDarkPartner(tokens: string[], at: number, utility: string): boolean {
  const isQuote = (token: string) => token === '"' || token === "'" || token === "`";
  let start = at;
  while (start > 0 && !isQuote(tokens[start - 1])) start--;
  for (let k = start; k < tokens.length && !isQuote(tokens[k]); k++) {
    if (tokens[k].startsWith(`dark:${utility}-`)) return true;
  }
  return false;
}

/** One rule per table entry. */
export function rulesFor(map: ClassMap): NamedRule[] {
  const rules: NamedRule[] = [];
  for (const [oldClass, newClass] of Object.entries(map.classes)) {
    const pattern = new RegExp(`^((?:[^\\s:]+:)*)${escapeRegExp(oldClass)}(/[\\w.%\\[\\]]+)?$`);
    const utility = oldClass.split("-")[0];
    rules.push({
      key: `${oldClass} → ${newClass}`,
      apply: (removed, i, added, j) => {
        const match = pattern.exec(removed[i] ?? "");
        if (!match) return null;
        // A light class with a `dark:` partner maps only as a pair.
        if (!match[1] && hasDarkPartner(removed, i, utility)) return null;
        const expected = `${match[1]}${newClass}${match[2] ?? ""}`;
        return added[j] === expected ? { di: 1, dj: 1 } : null;
      },
    });
  }
  for (const [oldPair, newClass] of Object.entries(map.pairs)) {
    const olds = oldPair.split(" ");
    rules.push({
      key: `${oldPair} → ${newClass}`,
      apply: (removed, i, added, j) =>
        startsWith(removed, i, olds) && added[j] === newClass ? { di: olds.length, dj: 1 } : null,
    });
  }
  for (const [hex, value] of Object.entries(map.inline)) {
    const news = tokenize(value);
    rules.push({
      key: `${hex} → ${value}`,
      apply: (removed, i, added, j) =>
        (removed[i] ?? "").toLowerCase() === hex && startsWith(added, j, news) ? { di: 1, dj: news.length } : null,
    });
  }
  return rules;
}

/**
 * Aligns one changed block: equal tokens, or table rules. Returns the rule
 * keys used, or null when no alignment exists.
 */
export function alignBlock(removed: string[], added: string[], rules: NamedRule[]): string[] | null {
  const width = added.length + 1;
  const parent = new Map<number, { from: number; key: string | null }>();
  const start = 0;
  const goal = removed.length * width + added.length;
  parent.set(start, { from: -1, key: null });
  const queue = [start];
  while (queue.length > 0) {
    const state = queue.shift() as number;
    if (state === goal) break;
    const i = Math.floor(state / width);
    const j = state % width;
    const steps: Array<{ di: number; dj: number; key: string | null }> = [];
    if (i < removed.length && j < added.length && removed[i] === added[j]) steps.push({ di: 1, dj: 1, key: null });
    for (const rule of rules) {
      const step = rule.apply(removed, i, added, j);
      if (step) steps.push({ ...step, key: rule.key });
    }
    for (const step of steps) {
      const next = (i + step.di) * width + (j + step.dj);
      if (parent.has(next)) continue;
      parent.set(next, { from: state, key: step.key });
      queue.push(next);
    }
  }
  if (!parent.has(goal)) return null;
  const used: string[] = [];
  for (let state = goal; state !== start; ) {
    const step = parent.get(state) as { from: number; key: string | null };
    if (step.key) used.push(step.key);
    state = step.from;
  }
  return used.reverse();
}

/** Changed line blocks between two texts: `[oldStart, oldEnd, newStart, newEnd)`, 0-based. */
export function changedBlocks(before: string[], after: string[]): Array<[number, number, number, number]> {
  const n = before.length;
  const m = after.length;
  const lcs = new Int32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * (m + 1) + j] =
        before[i] === after[j]
          ? lcs[(i + 1) * (m + 1) + j + 1] + 1
          : Math.max(lcs[(i + 1) * (m + 1) + j], lcs[i * (m + 1) + j + 1]);
    }
  }
  const blocks: Array<[number, number, number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) {
      i++;
      j++;
      continue;
    }
    const oldStart = i;
    const newStart = j;
    while ((i < n || j < m) && !(i < n && j < m && before[i] === after[j])) {
      if (j >= m || (i < n && lcs[(i + 1) * (m + 1) + j] >= lcs[i * (m + 1) + j + 1])) i++;
      else j++;
    }
    blocks.push([oldStart, i, newStart, j]);
  }
  return blocks;
}

export interface DiffResult {
  /** Rule key → times used. */
  substitutions: Record<string, number>;
  /** One entry per block no alignment explains. */
  failures: Array<{ line: number; removed: string; added: string }>;
}

/** Checks one file's old and new source against the table. */
export function diffSource(before: string, after: string, map: ClassMap): DiffResult {
  const rules = rulesFor(map);
  const oldLines = stripComments(before).split("\n");
  const newLines = stripComments(after).split("\n");
  const result: DiffResult = { substitutions: {}, failures: [] };
  for (const [oldStart, oldEnd, newStart, newEnd] of changedBlocks(oldLines, newLines)) {
    const removed = tokenize(oldLines.slice(oldStart, oldEnd).join("\n"));
    const added = tokenize(newLines.slice(newStart, newEnd).join("\n"));
    const used = alignBlock(removed, added, rules);
    if (used === null) {
      result.failures.push({
        line: newStart + 1,
        removed: oldLines.slice(oldStart, oldEnd).join("\n").trim(),
        added: newLines.slice(newStart, newEnd).join("\n").trim(),
      });
      continue;
    }
    for (const key of used) result.substitutions[key] = (result.substitutions[key] ?? 0) + 1;
  }
  return result;
}

function main(): void {
  const args = process.argv.slice(2);
  const option = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const setName = option("--set") ?? "";
  const map = CLASS_MAPS[setName];
  if (!map) throw new Error(`pass --set <${Object.keys(CLASS_MAPS).join("|")}>`);
  const base = option("--base") ?? "origin/main";
  const named = args.filter((arg, k) => !arg.startsWith("--") && !["--set", "--base"].includes(args[k - 1]));
  const files = named.length > 0 ? named : map.files;
  const totals: Record<string, number> = {};
  let failed = 0;
  for (const file of files) {
    const before = execFileSync("git", ["show", `${base}:${file}`], { cwd: ROOT, encoding: "utf8" });
    const after = readFileSync(join(ROOT, file), "utf8");
    const { substitutions, failures } = diffSource(before, after, map);
    const count = Object.values(substitutions).reduce((sum, n) => sum + n, 0);
    console.log(`${failures.length === 0 ? "ok  " : "FAIL"}\t${count} substitution(s)\t${file}`);
    for (const failure of failures) {
      failed += 1;
      console.log(`  ${file}:${failure.line}\n    - ${failure.removed}\n    + ${failure.added}`);
    }
    for (const [key, n] of Object.entries(substitutions)) totals[key] = (totals[key] ?? 0) + n;
  }
  for (const [key, n] of Object.entries(totals).sort()) console.log(`${String(n).padStart(4)}  ${key}`);
  console.log(`${files.length} file(s) against ${base}; ${failed} unexplained change(s)`);
  if (failed > 0) process.exit(1);
}

if (process.argv[1]?.endsWith("design-class-diff.ts")) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
