/**
 * Pure input handling for the weekly digest (#181).
 *
 * Why: the digest service mixes a database, an LLM and publishing rules; the
 * rules themselves (which tier a week gets, what text the model may read, what
 * the hash covers, what the stored text looks like) need no I/O and are easier
 * to pin on their own.
 * What: `digestTier` maps an article count to one of three branches.
 * `articleSummaryForPrompt` feeds the model a summary only when it passes
 * `validateSummary`, else the `toMetaDescription` cut. `siteChangesForWindow`
 * reads the generated changelog for one window. `calculateDigestHash` hashes the
 * input ids. `buildDigestPrompt` writes the two prompts. `assembleDigest` builds
 * the title and the source list in code around the model's body.
 * Test: `tests/unit/weekly-digest-input-181.test.ts`.
 */

import { createHash } from "node:crypto";
import { toMetaDescription, validateSummary } from "@/lib/article-summary";
import type { ChangelogEntry } from "@/lib/data/changelog-generator";
import { DIGEST_WORDS, type DigestTier } from "@/lib/weekly-digest-validate";
import { type IsoWeekWindow, weekRangeLabel } from "@/lib/weekly-digest-window";

/** One article as the digest reads it. */
export interface DigestArticle {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  publishedAt: Date | null;
  toolMentions: unknown;
}

/** A tool added during the window. */
export interface DigestNewTool {
  id: string;
  name: string;
  category: string;
}

/** A reader-visible site change dated inside the window. */
export interface DigestSiteChange {
  id: string;
  title: string;
}

export interface DigestInputs {
  window: IsoWeekWindow;
  tier: DigestTier;
  articles: DigestArticle[];
  newTools: DigestNewTool[];
  siteChanges: DigestSiteChange[];
}

/**
 * 0 articles is no digest, 1-2 a short one, 3 or more
 * the full shape.
 */
export function digestTier(articleCount: number): DigestTier | null {
  if (articleCount <= 0) return null;
  return articleCount < 3 ? "short" : "full";
}

/**
 * The text of an article the model reads.
 *
 * #181: a post-#179 summary that passes `validateSummary` is used as stored. A
 * longer or malformed one (pre-#179 rows hold 400-500 words) is cut with
 * `toMetaDescription`, and an article with no summary contributes its title.
 */
export function articleSummaryForPrompt(article: Pick<DigestArticle, "title" | "summary">): string {
  const summary = article.summary?.trim();
  if (!summary) return article.title;
  return validateSummary(summary).length === 0 ? summary : toMetaDescription(summary);
}

/** Tool names an article mentions: `toolMentions` holds `{ tool }` objects or plain names. */
export function toolNamesOf(article: Pick<DigestArticle, "toolMentions">): string[] {
  if (!Array.isArray(article.toolMentions)) return [];
  const names = article.toolMentions
    .map((m: unknown) => (typeof m === "string" ? m : (m as { tool?: unknown } | null)?.tool))
    .filter((n): n is string => typeof n === "string" && n.trim() !== "");
  return [...new Set(names)];
}

/**
 * Site changes dated inside `window`, from the generated changelog.
 *
 * What: Both window edges are included. The one-line `title` is used, not the
 * long description, and a trailing "(#123)" issue reference is dropped so the
 * model has no number to repeat.
 */
export function siteChangesForWindow(
  window: IsoWeekWindow,
  entries: readonly ChangelogEntry[]
): DigestSiteChange[] {
  return entries
    .filter((e) => {
      const at = new Date(e.date).getTime();
      return at >= window.start.getTime() && at <= window.end.getTime();
    })
    .map((e) => ({ id: e.id, title: e.title.replace(/\s*\(#\d+\)/g, "").trim() }));
}

/** SHA-256 over the week and the sorted input ids, stored as `data_hash`. */
export function calculateDigestHash(input: {
  week: string;
  articleIds: readonly string[];
  toolIds: readonly string[];
  changeIds: readonly string[];
}): string {
  const sorted = (ids: readonly string[]) => [...ids].sort();
  const text = JSON.stringify({
    week: input.week,
    articleIds: sorted(input.articleIds),
    toolIds: sorted(input.toolIds),
    changeIds: sorted(input.changeIds),
  });
  return createHash("sha256").update(text).digest("hex");
}

/** Escapes the brackets that would end a markdown link text early. */
function linkText(title: string): string {
  return title.replace(/[[\]]/g, (c) => `\\${c}`);
}

/**
 * The stored markdown: a code-built title, the model's body, and a code-built
 * source list. The model writes neither the title nor the links to sources.
 */
export function assembleDigest(
  window: IsoWeekWindow,
  body: string,
  articles: ReadonlyArray<Pick<DigestArticle, "slug" | "title">>
): string {
  const parts = [`# AI coding tools: week of ${weekRangeLabel(window)}`, "", body.trim()];
  if (articles.length > 0) {
    parts.push("", "## Sources", "");
    for (const a of articles) parts.push(`- [${linkText(a.title)}](/en/news/${a.slug})`);
  }
  return `${parts.join("\n")}\n`;
}

const SYSTEM_RULES = `You write the weekly digest for AI Power Rankings. The reader is a developer or team lead choosing or tracking AI coding tools. Write in a factual, plain tone. No hype, no marketing words, and no opinion on which tool is best.

Use only the material under "Source material". Do not add facts, tool names, dates or numbers that it does not hold.

Hard rules:
- No scores, ratings, rankings or rank changes, and no numbers that state one. Say what happened, not how a tool is rated.
- Links: only [text](/en/news/<slug>) with a slug from the source material, or [AI Power Rankings](/). No other links and no bare URLs.
- Do not write a title, a "Sources" section or a closing summary. Code adds the title and the source list.
- Plain markdown only: no HTML, no tables, no bold text used as a heading.
- Heading and bullet markers do not count as words.`;

function tierRules(tier: DigestTier, hasNewAndChanged: boolean): string {
  const { min, max } = DIGEST_WORDS[tier];
  if (tier === "short") {
    return `This was a quiet week. Write ${min}-${max} words in this exact structure, with no headings:
1. An opening paragraph of 2 sentences: what the week covered and the biggest item.
2. One bullet per article, each one line, each linking its article.`;
  }
  const newAndChanged = hasNewAndChanged
    ? 'Then "## New and changed": the new tools and site changes in the material.'
    : 'Do not write a "New and changed" section: the material has none.';
  return `Write ${min}-${max} words (aim for about 300) in this exact structure:
1. An opening of 2 sentences with no heading: how many articles and tools the week covered, and the biggest item.
2. "## The week in short": 3 or 4 bullets, one line each, each linking one article.
3. "## What mattered": 2 or 3 short paragraphs that name tools and link their articles.
4. ${newAndChanged}
5. Optionally "## Worth watching": 1 or 2 sentences, only claims the articles support.`;
}

function sourceMaterial(inputs: DigestInputs): string {
  const lines = [`Week: ${weekRangeLabel(inputs.window)} (UTC)`, "", `Articles (${inputs.articles.length}):`];
  inputs.articles.forEach((a, i) => {
    const tools = toolNamesOf(a);
    const date = a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : "undated";
    lines.push(
      `${i + 1}. ${a.title} (slug: ${a.slug}; published ${date}${tools.length ? `; tools: ${tools.join(", ")}` : ""})`,
      `   ${articleSummaryForPrompt(a)}`
    );
  });
  if (inputs.newTools.length > 0) {
    lines.push("", `New tools (${inputs.newTools.length}):`);
    for (const t of inputs.newTools) lines.push(`- ${t.name} (${t.category})`);
  }
  if (inputs.siteChanges.length > 0) {
    lines.push("", `Site changes (${inputs.siteChanges.length}):`);
    for (const c of inputs.siteChanges) lines.push(`- ${c.title}`);
  }
  return lines.join("\n");
}

/**
 * The system and user prompts for one attempt.
 *
 * `previousFailures`, when given, are the validator's failed checks for the
 * last draft; they are named in the user prompt so the one retry can fix them.
 */
export function buildDigestPrompt(
  inputs: DigestInputs,
  previousFailures: readonly string[] = []
): { system: string; user: string } {
  const hasNewAndChanged = inputs.newTools.length + inputs.siteChanges.length > 0;
  const retry =
    previousFailures.length > 0
      ? `\n\nYour previous draft failed these checks: ${previousFailures.join("; ")}. Write the whole digest again and fix them.`
      : "";
  return {
    system: `${SYSTEM_RULES}\n\n${tierRules(inputs.tier, hasNewAndChanged)}`,
    user: `Source material\n\n${sourceMaterial(inputs)}\n\nWrite the digest now.${retry}`,
  };
}
