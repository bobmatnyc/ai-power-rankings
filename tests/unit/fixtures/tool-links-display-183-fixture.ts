/**
 * PGlite catalogue for the #183 B-2 step 2 display tests (API `links` field, tool page block).
 *
 * Why: the API and page tests must read links through the real repository SQL, so they
 *   share one small catalogue with known links on a real PGlite database at 0016.
 * What: `displayDb()` builds `linkedDb(DISPLAY_TOOLS)` and inserts `DISPLAY_LINKS` raw, so
 *   the stored `javascript:` URL (which the writer refuses) can exist for the render guard.
 * Test: used by `tests/unit/tool-links-api-183.test.ts` and `tests/unit/tool-links-page-183.test.tsx`.
 */

import { type FixtureTool, linkedDb } from "./tool-links-183-fixture";

export const DISPLAY_TOOLS: FixtureTool[] = [
  { slug: "claude-code", name: "Claude Code", kind: "harness" },
  { slug: "cursor", name: "Cursor", kind: "harness" },
  { slug: "retired-harness", name: "Retired Harness", kind: "harness", status: "inactive" },
  { slug: "opus-4-6", name: "Opus 4.6", kind: "model" },
  { slug: "sonnet-4-5", name: "Sonnet 4.5", kind: "model" },
  { slug: "retired-model", name: "Retired Model", kind: "model", status: "deprecated" },
  { slug: "anthropic", name: "Anthropic", kind: "other" },
];

export const OPUS_SOURCE = "https://example.com/docs/models";
export const SONNET_SOURCE = "https://example.com/docs/sonnet";
export const SCRIPT_SOURCE = "javascript:alert(1)";

/** [model, harness, relation, source_url] */
export const DISPLAY_LINKS: [string, string, string, string | null][] = [
  ["sonnet-4-5", "claude-code", "supports", SONNET_SOURCE],
  ["opus-4-6", "claude-code", "native", OPUS_SOURCE],
  ["retired-model", "claude-code", "native", OPUS_SOURCE],
  ["opus-4-6", "cursor", "supports", null],
  ["sonnet-4-5", "cursor", "supports", SCRIPT_SOURCE],
  ["opus-4-6", "retired-harness", "native", OPUS_SOURCE],
];

export async function displayDb() {
  const built = await linkedDb(DISPLAY_TOOLS);
  for (const [model, harness, relation, source] of DISPLAY_LINKS) {
    await built.pg.query(
      `INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation, source_url)
       SELECT m.id, h.id, $3, $4 FROM public."tools" m, public."tools" h WHERE m.slug = $1 AND h.slug = $2`,
      [model, harness, relation, source]
    );
  }
  return built;
}
