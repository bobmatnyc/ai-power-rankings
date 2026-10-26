/**
 * The logo lint: `public/logos/` and `data/logos/manifest.json` must agree (L1).
 *
 * Why: a file with no recorded terms, a hash that no longer matches, or a `monogram` vendor
 *   that still ships a mark is a licensing defect that review does not reliably catch.
 * What: `lintLogos` reads the manifest and walks the logos directory under `root`; it returns
 *   one message per problem (empty means clean). It covers `public/logos` only.
 *   // See D82: the legacy `public/tool-icons` PNGs are out of scope here; L2 re-sources or
 *   // removes them.
 * Test: `tests/unit/logo-lint.test.ts` (a good fixture and each bad case, in temp dirs).
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { LOGOS_DIR, logoManifestSchema, validateManifest } from "./manifest";

export const MANIFEST_PATH = "data/logos/manifest.json";

/** Files in the logos directory that are not marks and need no manifest entry. */
const NON_MARKS = new Set(["README.md", ".gitkeep"]);

function listFiles(dir: string, base: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const rel = `${base}/${d.name}`;
    return d.isDirectory() ? listFiles(path.join(dir, d.name), rel) : NON_MARKS.has(d.name) ? [] : [rel];
  });
}

export function lintLogos(root: string): string[] {
  const manifestFile = path.join(root, MANIFEST_PATH);
  if (!existsSync(manifestFile)) return [`${MANIFEST_PATH}: missing`];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestFile, "utf8"));
  } catch (e) {
    return [`${MANIFEST_PATH}: not valid JSON (${(e as Error).message})`];
  }
  const errors = validateManifest(raw);
  const parsed = logoManifestSchema.safeParse(raw);
  if (!parsed.success) return errors;

  const listed = new Set<string>();
  for (const entry of parsed.data.logos) {
    if (!entry.file) continue;
    listed.add(entry.file);
    const abs = path.join(root, entry.file);
    if (!existsSync(abs)) {
      errors.push(`${entry.vendor}: file ${entry.file} is missing`);
      continue;
    }
    const actual = createHash("sha256").update(readFileSync(abs)).digest("hex");
    if (entry.sha256 && actual !== entry.sha256) {
      errors.push(`${entry.vendor}: sha256 of ${entry.file} does not match the manifest`);
    }
  }
  for (const file of listFiles(path.join(root, LOGOS_DIR), LOGOS_DIR)) {
    if (!listed.has(file)) errors.push(`${file}: no manifest entry`);
  }
  return errors;
}
