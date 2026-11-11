/**
 * Reads the tool name out of a stored `articles.tool_mentions` element (#434).
 *
 * Why: rows hold two shapes. Older admin saves stored bare name strings; the
 * ingestion path and, since #434, the admin `saveAsArticle` path store mention
 * objects (`{ tool, raw_tool, context, ... }`, #187). Readers that called
 * `mention.toLowerCase()` or `.join(", ")` broke on objects.
 * What: pure functions, no imports, safe in client components. A string is its
 * own name; an object yields `tool`, else `name`. Names are trimmed; an empty
 * or non-string value yields no name. No row is rewritten.
 * Test: `tests/unit/tool-mention-shape-434.test.ts`.
 */

/** A stored mention: a bare name (old rows) or a mention object (#187). */
export type StoredToolMention =
  | string
  | { tool?: string; name?: string; raw_tool?: string; toolId?: string; [key: string]: unknown };

/** The mention's tool name, or null when it carries none. */
export function toolMentionName(mention: unknown): string | null {
  const raw =
    typeof mention === "string"
      ? mention
      : mention && typeof mention === "object"
        ? [(mention as Record<string, unknown>)["tool"], (mention as Record<string, unknown>)["name"]].find(
            (v) => typeof v === "string" && v.trim() !== ""
          )
        : undefined;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

/** Every mention's tool name in stored order; a non-array or a nameless mention adds nothing. */
export function toolMentionNames(mentions: unknown): string[] {
  if (!Array.isArray(mentions)) return [];
  return mentions.map(toolMentionName).filter((n): n is string => n !== null);
}
