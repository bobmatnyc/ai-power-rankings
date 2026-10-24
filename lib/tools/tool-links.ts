/**
 * The model <-> harness links a tool page and `GET /api/tools/[slug]/json` show (#183 B-2 step 2).
 *
 * Why: a harness page lists the models it runs and a model page lists the harnesses that
 *   offer it. The page and the API must show the same set, read the same way.
 * What: `readToolLinks` runs both repository reads for one slug. A tool has one kind, so at
 *   most one read returns rows: `getModelsForHarness` answers `[]` for a non-harness and
 *   `getHarnessesForModel` answers `[]` for a non-model. The result names which block it
 *   is (`direction`) and drops the internal id. A stored `sourceUrl` that is not an
 *   absolute http(s) URL becomes `null`. A failed read rejects; the callers decide.
 *   `describeReadError` gives a log line with no row content.
 * Test: `tests/unit/tool-links-api-183.test.ts`, `tests/unit/tool-links-page-183.test.tsx`.
 */

import {
  getHarnessesForModel,
  getModelsForHarness,
  isHttpUrl,
  type ToolLinkRelation,
  type ToolLinksDb,
} from "@/lib/db/repositories/tool-links.repository";

/** `models`: the tool is a harness and the list is its models. `harnesses`: the mirror. */
export type ToolLinksDirection = "models" | "harnesses";

/** One linked tool as the page and the API show it. */
export interface ToolLinkEntry {
  slug: string;
  name: string;
  relation: ToolLinkRelation;
  sourceUrl: string | null;
}

export interface ToolLinks {
  /** `null` when the tool has no links (or is neither a harness nor a model). */
  direction: ToolLinksDirection | null;
  links: ToolLinkEntry[];
}

/** The URL when it is an absolute http(s) URL, else `null`. Render-time and API-time guard. */
export function safeSourceUrl(url: string | null | undefined): string | null {
  return typeof url === "string" && isHttpUrl(url) ? url : null;
}

/** Reads the links of the tool with `slug`, native first. Rejects when a read fails. */
export async function readToolLinks(db: ToolLinksDb, slug: string): Promise<ToolLinks> {
  const [models, harnesses] = await Promise.all([
    getModelsForHarness(db, { slug }),
    getHarnessesForModel(db, { slug }),
  ]);
  const [direction, rows]: [ToolLinksDirection | null, typeof models] =
    models.length > 0 ? ["models", models] : harnesses.length > 0 ? ["harnesses", harnesses] : [null, []];
  return {
    direction,
    links: rows.map((r) => ({ slug: r.slug, name: r.name, relation: r.relation, sourceUrl: safeSourceUrl(r.sourceUrl) })),
  };
}

/**
 * A log-safe description of a failed links read: the error class and the Postgres
 * SQLSTATE when there is one. Never the message, which can carry query text or params.
 */
export function describeReadError(error: unknown): { error: string; code?: string } {
  const name = error instanceof Error ? error.name : typeof error;
  const withCode = (e: unknown) => (e && typeof e === "object" && "code" in e ? (e as { code: unknown }).code : undefined);
  const code = withCode(error) ?? withCode(error instanceof Error ? error.cause : undefined);
  return typeof code === "string" ? { error: name, code } : { error: name };
}
