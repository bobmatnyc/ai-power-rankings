/**
 * Vendor-logo provenance manifest: schema, validation and the public-URL helper (L1).
 *
 * Why: a vendor mark may be shown only where its terms allow it. Every file under
 *   `public/logos/` therefore needs a recorded source, terms and hash, and a vendor whose
 *   terms forbid the mark is shown as a monogram with no file (D82). The check must run in
 *   CI, so the rules live in code, not in a review habit.
 * What: `logoManifestSchema` (zod) types `data/logos/manifest.json`; `validateManifest`
 *   returns one message per problem instead of throwing, so the lint reports all of them;
 *   `permittedLogoUrl` maps a vendor to the public URL of its `permitted` file.
 * Test: `tests/unit/logo-lint.test.ts`, `tests/unit/vendor-map.test.ts`.
 */

import { z } from "zod";

export const LOGO_STATUSES = ["permitted", "reference-only", "monogram"] as const;
export type LogoStatus = (typeof LOGO_STATUSES)[number];

/** Directory, relative to the repo root, that holds vendor marks and nothing else. */
export const LOGOS_DIR = "public/logos";

/** Where a `reference-only` file lives. Outside `public/`, so a mark we may not show is never served. */
export const REFERENCE_DIR = "data/logos/reference";

const nonEmpty = z.string().trim().min(1);
const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a kebab-case slug");

export const logoEntrySchema = z.object({
  vendor: kebab,
  /** Repo-relative path: `public/logos/` for `permitted`, `data/logos/reference/` for `reference-only`; null only for `monogram`. */
  file: nonEmpty.nullable(),
  source_url: nonEmpty,
  terms_url: nonEmpty,
  terms_note: nonEmpty,
  /** ISO calendar date, `YYYY-MM-DD`. */
  fetched_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)"),
  /** Lower-case hex SHA-256 of the file; null only for a `monogram` entry. */
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "must be 64 lower-case hex characters")
    .nullable(),
  status: z.enum(LOGO_STATUSES),
});
export type LogoEntry = z.infer<typeof logoEntrySchema>;

export const logoManifestSchema = z.object({
  version: z.literal(1),
  logos: z.array(logoEntrySchema),
});
export type LogoManifest = z.infer<typeof logoManifestSchema>;

/**
 * Checks the manifest's shape and its file rules; returns one message per problem.
 *
 * Postcondition: an empty array means every entry is well formed, a `monogram` entry has no
 * file and no hash, any other entry has both, a `permitted` file is under `public/logos/`, a
 * `reference-only` file is under `data/logos/reference/` (never `public/`), and no path repeats.
 */
export function validateManifest(raw: unknown): string[] {
  const parsed = logoManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `manifest: ${i.path.join(".") || "(root)"}: ${i.message}`);
  }
  const errors: string[] = [];
  const seen = new Set<string>();
  parsed.data.logos.forEach((entry, i) => {
    const at = `manifest.logos[${i}] (${entry.vendor})`;
    if (entry.status === "monogram") {
      if (entry.file !== null || entry.sha256 !== null) errors.push(`${at}: a monogram entry must not ship a file`);
      return;
    }
    if (entry.file === null) errors.push(`${at}: file is required for status ${entry.status}`);
    if (entry.sha256 === null) errors.push(`${at}: sha256 is required for status ${entry.status}`);
    if (entry.file !== null) {
      // #303: everything in public/ is served, so a mark we may not display stays out of it.
      const dir = entry.status === "permitted" ? LOGOS_DIR : REFERENCE_DIR;
      if (!entry.file.startsWith(`${dir}/`)) errors.push(`${at}: ${entry.status} file must be under ${dir}/`);
      if (seen.has(entry.file)) errors.push(`${at}: file ${entry.file} is listed twice`);
      seen.add(entry.file);
    }
  });
  return errors;
}

/** The public URL (`/logos/<file>`) of a vendor's `permitted` file, or null when it has none. */
export function permittedLogoUrl(manifest: LogoManifest, vendorSlug: string): string | null {
  const entry = manifest.logos.find((e) => e.vendor === vendorSlug && e.status === "permitted" && e.file);
  return entry?.file ? entry.file.replace(/^public/, "") : null;
}

/** True when the manifest records the vendor at all, whatever the status. */
export function hasManifestEntry(manifest: LogoManifest, vendorSlug: string): boolean {
  return manifest.logos.some((e) => e.vendor === vendorSlug);
}
