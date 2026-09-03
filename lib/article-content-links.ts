/**
 * Article body link handling for the news detail view.
 *
 * Why: Article detail pages rendered the same links twice. The ingestion
 * prompt told the model to append a `**Related Links:**` markdown block to
 * `rewritten_content`, so that block rendered as prose; the detail component
 * separately regex-extracted every markdown link out of the same string and
 * rendered them again under "Referenced Links". Both lists came from one
 * field, so they could never disagree. The owner chose to keep only
 * "Referenced Links".
 * What: `extractExternalLinks` pulls markdown links out of the raw content
 * (deduplicated by URL) to feed the single remaining list, and
 * `stripRelatedLinksSection` removes the redundant in-body block before the
 * content is rendered as prose. Extraction must run on the ORIGINAL content,
 * not the stripped copy, or the surviving list would come up empty.
 * Test: `lib/article-content-links.test.ts`
 */

export interface ExternalLink {
  text: string;
  url: string;
}

/** Matches a markdown inline link: `[text](url)`. */
const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Matches a "Related Links" heading line in any form the model emits:
 * `**Related Links:**`, `## Related Links`, `__Related Links__`, or bare
 * `Related Links:`. Trailing colons appear inside or outside the emphasis
 * markers depending on the generation, so both positions are optional.
 */
const RELATED_LINKS_HEADING =
  /^[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*|__)?[ \t]*related[ \t]+links[ \t]*:?[ \t]*(?:\*\*|__)?[ \t]*:?[ \t]*$/i;

/** Matches a bullet or numbered list item whose body is a markdown link. */
const LINK_LIST_ITEM = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+.*\[[^\]]+\]\([^)]+\)/;

/**
 * Why: The "Referenced Links" list is the only links section the page renders,
 * so a URL repeated between the article body and its trailing Related Links
 * block would surface as a duplicate row.
 * What: Returns every markdown link in `content` in document order, keeping
 * the first occurrence of each URL.
 * Test: `extracts links`, `deduplicates repeated urls` in
 * `lib/article-content-links.test.ts`
 */
export function extractExternalLinks(content: string): ExternalLink[] {
  if (!content) return [];

  const links: ExternalLink[] = [];
  const seen = new Set<string>();
  const pattern = new RegExp(MARKDOWN_LINK.source, "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const url = match[2].trim();
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ text: match[1], url });
  }

  return links;
}

/**
 * Why: Removes the duplicate in-body links section so exactly one links
 * section ("Referenced Links") renders on an article page.
 * What: Drops each "Related Links" heading together with the contiguous run of
 * link list items beneath it. Deliberately conservative — a heading with no
 * link list under it is left alone, so prose that merely mentions the phrase
 * is never truncated.
 * Test: `strips the trailing related links block`,
 * `leaves a heading with no link list untouched` in
 * `lib/article-content-links.test.ts`
 */
export function stripRelatedLinksSection(content: string): string {
  if (!content) return content;

  const lines = content.split("\n");
  const kept: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!RELATED_LINKS_HEADING.test(lines[i])) {
      kept.push(lines[i]);
      continue;
    }

    // Look past blank lines for the link list that makes this a links block.
    let cursor = i + 1;
    while (cursor < lines.length && lines[cursor].trim() === "") cursor++;

    if (cursor >= lines.length || !LINK_LIST_ITEM.test(lines[cursor])) {
      // No link list follows — leave the line in place rather than risk
      // truncating real prose.
      kept.push(lines[i]);
      continue;
    }

    // Consume the list, allowing blank lines between items.
    while (cursor < lines.length) {
      if (LINK_LIST_ITEM.test(lines[cursor])) {
        cursor++;
        continue;
      }
      if (lines[cursor].trim() === "") {
        // Only skip a blank line if another list item follows it.
        let lookahead = cursor;
        while (lookahead < lines.length && lines[lookahead].trim() === "") lookahead++;
        if (lookahead < lines.length && LINK_LIST_ITEM.test(lines[lookahead])) {
          cursor = lookahead;
          continue;
        }
      }
      break;
    }

    i = cursor - 1;
  }

  return kept.join("\n").replace(/\s+$/, "");
}
