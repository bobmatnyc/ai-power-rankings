/**
 * Why: #477 — a scrape whose body was a cookie banner reached the LLM, which
 * wrote "(article body unavailable)" into a title, and the row was inserted as
 * an active article. Extraction must refuse such a body before analysis.
 * What: `assertArticleBody` throws `ArticleBodyRejectedError` for an empty,
 * too-short, or consent/boilerplate-only body; otherwise it returns.
 * Test: `tests/unit/article-body-guard-477.test.ts`.
 */

export type ArticleBodyRejectionReason = "empty_body" | "body_too_short" | "boilerplate_body";

/** A typed refusal: the extracted body is not an article. */
export class ArticleBodyRejectedError extends Error {
  readonly reason: ArticleBodyRejectionReason;

  constructor(reason: ArticleBodyRejectionReason, detail: string) {
    super(`article_body_rejected: ${reason} (${detail})`);
    this.name = "ArticleBodyRejectedError";
    this.reason = reason;
  }
}

// #477: 100 chars is the threshold the pipeline already uses for "sufficient
// content" (Jina success in ContentExtractor.extractFromUrl, the candidate
// content check in automated-ingestion). It rejects empty and stub bodies while
// any real news piece, however short, clears it.
export const MIN_ARTICLE_BODY_CHARS = 100;

// #477: consent/boilerplate markers. A sentence carrying one is discarded; the
// body is rejected only when what remains is below MIN_ARTICLE_BODY_CHARS, so a
// real article that mentions cookies or privacy once still passes.
const BOILERPLATE_MARKER =
  /\b(cookies?|consent|privacy (policy|preferences|settings|choices)|accept all|reject all|manage (preferences|settings)|tracking technologies|enable javascript|subscribe to (read|continue)|sign in to (read|continue))\b/i;

/** Throws `ArticleBodyRejectedError` when `content` is not an article body. */
export function assertArticleBody(content: string | null | undefined): void {
  const raw = content ?? "";
  const body = raw.replace(/\s+/g, " ").trim();
  if (body.length === 0) {
    throw new ArticleBodyRejectedError("empty_body", "0 chars");
  }
  if (body.length < MIN_ARTICLE_BODY_CHARS) {
    throw new ArticleBodyRejectedError("body_too_short", `${body.length}<${MIN_ARTICLE_BODY_CHARS} chars`);
  }
  const substantive = raw
    // #477: split on newlines too, so a Jina markdown heading or list item
    // without terminal punctuation is judged alone, not merged into a block.
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !BOILERPLATE_MARKER.test(sentence))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (substantive.length < MIN_ARTICLE_BODY_CHARS) {
    throw new ArticleBodyRejectedError(
      "boilerplate_body",
      `${substantive.length}<${MIN_ARTICLE_BODY_CHARS} chars outside consent/boilerplate text`
    );
  }
}
