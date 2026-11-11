/**
 * SQL condition: an `articles.tool_mentions` array mentions `toolName` (#434).
 *
 * Why: the stored array holds bare name strings (old admin saves) or mention
 * objects keyed `tool` (ingestion, and admin `saveAsArticle` since #434) or
 * `name` (older objects). Each lookup tested only some shapes, so a row in the
 * missing shape never matched.
 * What: one parenthesised OR of three JSONB containments — `["X"]`,
 * `[{"tool":"X"}]`, `[{"name":"X"}]` — so every shape matches. Exact,
 * case-sensitive, as `@>` is; the GIN index on the column still applies.
 * Test: `tests/unit/tool-mention-shape-434.test.ts`.
 */
import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export function toolMentionMatches(column: AnyPgColumn, toolName: string): SQL {
  return sql`(${column}::jsonb @> ${JSON.stringify([toolName])}::jsonb OR ${column}::jsonb @> ${JSON.stringify([
    { tool: toolName },
  ])}::jsonb OR ${column}::jsonb @> ${JSON.stringify([{ name: toolName }])}::jsonb)`;
}
