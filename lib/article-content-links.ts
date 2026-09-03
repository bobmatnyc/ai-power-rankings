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
 *
 * #122: the Related Links block frequently carried the SOURCE SITE's own
 * footer/sister-site navigation (e.g. Insurance Journal's mynewmarkets.com,
 * claimsjournal.com, insurancejournal.tv, ijacademy.com, carriermanagement.com)
 * rather than story-relevant references — a naive same-domain filter cannot
 * catch these because they are, deliberately, on a DIFFERENT domain from the
 * source article. `looksLikeChromeLink` / `filterChromeLinks` recognize the
 * SHAPE a chrome link takes: every one of those five is a bare domain root
 * (`isRootPathUrl`), where a genuine in-story citation points at a specific
 * article/resource path — anchor text alone is NOT a reliable signal (a
 * code-review pass found the first version, which matched anchor text
 * against the linked hostname, both dropped `[TechCrunch](.../deep/path)`
 * as "site-name-only" and let `[Academy of Insurance](ijacademy.com/)`
 * through). These are applied at render time as a heuristic-only backstop
 * for both new and already-stored articles.
 * `sanitizeRelatedLinksBlock` is the stronger, ingestion-time counterpart:
 * given the actual page content/hrefs the model was shown, it drops any
 * Related Links entry whose URL was never actually offered to the model —
 * which is what a hallucinated "I know this publisher's usual sister sites"
 * link looks like — AND anything `looksLikeChromeLink` still flags, since a
 * scraped href list can legitimately contain the page's own real footer
 * links (verifiable, but still chrome).
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

/** Chrome-boilerplate anchor text seen on nav/footer/subscription links. */
const CHROME_TEXT_PATTERN =
  /^(subscribe|newsletter|sign[\s-]?up|log\s?in|home|about(\s+us)?|contact(\s+us)?|privacy(\s+policy)?|terms(\s+of\s+(use|service))?|advertise(\s+with\s+us)?|sister\s+publications?)$/i;

/**
 * Why: #122 correction — code review found the first version of this check
 * (matching anchor text against the linked hostname) both over- and
 * under-fired: `[TechCrunch](https://techcrunch.com/2026/08/28/...)` is
 * standard citation style, naming the outlet for a specific, deep-path
 * article — that got dropped as "site-name-only". Conversely
 * `[Academy of Insurance](https://www.ijacademy.com/)` — the actual #122
 * chrome link — has no textual overlap with "ijacademy" at all, so it
 * survived. Anchor text is not the reliable signal; URL SHAPE is. A
 * nav/footer/sister-site link almost always points at a domain's bare root
 * (nothing more specific than "the whole site" is being referenced); a
 * genuine in-story citation points at a specific article or resource path.
 * Accepted trade-off: a genuine root-path reference (e.g. a tool's own
 * homepage, cited as-is) is dropped too — see the "accepted trade-off" test
 * in `lib/article-content-links.test.ts`; loosening this to allow root URLs
 * back in reopens #122, so don't, without a stronger signal to replace it.
 * What: True when `url`'s path is empty or "/".
 * Test: `isRootPathUrl` tests in `lib/article-content-links.test.ts`
 */
export function isRootPathUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return pathname === "" || pathname === "/";
  } catch {
    return false;
  }
}

/**
 * Why: #122 — catches chrome links `isRootPathUrl` cannot, such as a
 * navigation item with a non-root path ("/subscribe") named after its own
 * section.
 * What: True when `text` (trimmed) matches known navigation/subscription
 * boilerplate.
 * Test: `isChromeBoilerplateText` tests in `lib/article-content-links.test.ts`
 */
export function isChromeBoilerplateText(text: string): boolean {
  return CHROME_TEXT_PATTERN.test(text.trim());
}

/**
 * Why: One shared "does this look like chrome" definition, used by both the
 * render-side backstop (`filterChromeLinks`) and the ingestion-time
 * sanitizer (`sanitizeRelatedLinksBlock`), so the two never disagree (#122).
 * What: True when `link` points at a bare domain root or matches known
 * boilerplate text.
 */
export function looksLikeChromeLink(link: ExternalLink): boolean {
  return isRootPathUrl(link.url) || isChromeBoilerplateText(link.text);
}

/**
 * Why: #122 code review — an href scraped from a raw HTML attribute
 * commonly entity-encodes `&` as `&amp;` (any query string with 2+
 * parameters), while the model's own markdown output, and the plain-text
 * source content, use a literal `&`. An exact-string comparison between the
 * two never matches, silently dropping a genuine, verifiable link.
 * What: Decodes the handful of HTML entities that can appear in a URL or
 * in extracted page text.
 */
function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/**
 * Why: #122 code review — beyond entity-encoding (see `decodeHtmlEntities`),
 * a trailing slash is cosmetic and must not defeat a same-URL match between
 * a scraped href and the model's own markdown output.
 * What: Entity-decodes and strips one trailing slash, so the same URL
 * compares equal regardless of which form it was captured in.
 */
function normalizeUrlForComparison(url: string): string {
  return decodeHtmlEntities(url.trim()).replace(/\/$/, "");
}

/**
 * Why: #122 — the "Referenced Links" list rendered a source site's own
 * footer/sister-site navigation as if it were story references (live
 * example: /en/news/russian-hackers-exploit-spacex-s-cursor-ai-tool-in-
 * multi-company-breach-campaign). This runs at render time, so it has no
 * access to the page originally extracted for ingestion and cannot verify a
 * link was ever really in the source — it can only recognize the SHAPE a
 * chrome link takes. That makes it a heuristic-only backstop, but it is the
 * only mitigation available for ALREADY-STORED articles, since the source
 * page content used at ingestion time is not persisted.
 * What: Returns `links` with every `looksLikeChromeLink` entry removed.
 * Test: `filterChromeLinks` tests in `lib/article-content-links.test.ts`
 */
export function filterChromeLinks(links: ExternalLink[]): ExternalLink[] {
  return links.filter((link) => !looksLikeChromeLink(link));
}

/**
 * Why: #122 — deterministic, ingestion-time gate on the LLM's own Related
 * Links block, independent of prompt compliance. `sourceContent` /
 * `sourceHrefs` are what the model was actually shown as source material; a
 * URL present in neither was never offered to the model, which is what a
 * hallucinated "I know this publisher's usual sister sites" link looks like
 * — the likely mechanism behind #122, since the Jina Reader extraction path
 * supplies no href list at all (markdown-only), yet the model still
 * produced specific, real sister-site URLs for the source publisher. A link
 * that IS verifiable but still `looksLikeChromeLink` is dropped too, since
 * extracted page text frequently still contains nav/footer chrome.
 * What: Rewrites the Related Links block in `rewrittenContent`, keeping only
 * bullet items whose URL resolves against `sourceHrefs` or appears in
 * `sourceContent` (by full URL or by hostname) AND that do not look like
 * chrome. Drops the heading entirely when every item is filtered out — an
 * empty block is valid; there is nothing left to reference. Body prose
 * outside the block is untouched.
 * Test: `sanitizeRelatedLinksBlock` tests in
 * `lib/article-content-links.test.ts`
 */
export function sanitizeRelatedLinksBlock(
  rewrittenContent: string,
  sourceContent: string,
  sourceHrefs: string[] = []
): string {
  if (!rewrittenContent) return rewrittenContent;

  // #122 code review: normalize both sides — a raw HTML href commonly
  // entity-encodes "&" and may carry a trailing slash the model's own
  // markdown output does not reproduce verbatim.
  const hrefSet = new Set(sourceHrefs.map((href) => normalizeUrlForComparison(href)));
  const lowerSource = decodeHtmlEntities(sourceContent).toLowerCase();

  const isVerifiable = (url: string): boolean => {
    const normalizedUrl = normalizeUrlForComparison(url);
    if (hrefSet.has(normalizedUrl)) return true;
    if (!lowerSource) return false;
    if (lowerSource.includes(normalizedUrl.toLowerCase())) return true;
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      return host.length > 0 && lowerSource.includes(host);
    } catch {
      return false;
    }
  };

  const lines = rewrittenContent.split("\n");
  const kept: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!RELATED_LINKS_HEADING.test(lines[i])) {
      kept.push(lines[i]);
      continue;
    }

    let cursor = i + 1;
    while (cursor < lines.length && lines[cursor].trim() === "") cursor++;

    if (cursor >= lines.length || !LINK_LIST_ITEM.test(lines[cursor])) {
      // No link list follows — leave the line in place, same as
      // stripRelatedLinksSection: nothing to sanitize.
      kept.push(lines[i]);
      continue;
    }

    const survivingItems: string[] = [];
    while (cursor < lines.length) {
      if (LINK_LIST_ITEM.test(lines[cursor])) {
        const match = new RegExp(MARKDOWN_LINK.source).exec(lines[cursor]);
        const url = match?.[2]?.trim();
        const text = match?.[1] ?? "";
        if (url && isVerifiable(url) && !looksLikeChromeLink({ text, url })) {
          survivingItems.push(lines[cursor]);
        }
        cursor++;
        continue;
      }
      if (lines[cursor].trim() === "") {
        let lookahead = cursor;
        while (lookahead < lines.length && lines[lookahead].trim() === "") lookahead++;
        if (lookahead < lines.length && LINK_LIST_ITEM.test(lines[lookahead])) {
          cursor = lookahead;
          continue;
        }
      }
      break;
    }

    if (survivingItems.length > 0) {
      kept.push(lines[i], ...survivingItems);
    }
    // else: drop the heading too, an empty Related Links block is noise.

    i = cursor - 1;
  }

  return kept.join("\n").replace(/\s+$/, "");
}
