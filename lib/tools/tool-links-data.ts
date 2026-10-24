/**
 * The links read behind the tool page's "Models it runs" / "Harnesses for this model"
 * block (#183 B-2 step 2).
 *
 * Why: the block is a read-only display. A failed read must not take the tool page down.
 * What: `getToolLinksForPage(slug)` reads through `readToolLinks` on the app database. It
 *   never rejects: no database, or a failed read, resolves `null` and the block renders
 *   nothing. A failure logs the error class and SQLSTATE only, never row content. This is
 *   the deliberate fail-soft path; no write path goes through it.
 * Test: `tests/unit/tool-links-page-183.test.tsx` ("links read failure").
 */
import { getDb } from "@/lib/db/connection";
import { describeReadError, readToolLinks, type ToolLinks } from "./tool-links";

/** The tool's links, or `null` when they could not be read. Never rejects. */
export async function getToolLinksForPage(slug: string): Promise<ToolLinks | null> {
  try {
    const db = getDb();
    if (!db) return null;
    return await readToolLinks(db, slug);
  } catch (error) {
    console.error("Tool page: tool links unavailable:", { slug, ...describeReadError(error) });
    return null;
  }
}
