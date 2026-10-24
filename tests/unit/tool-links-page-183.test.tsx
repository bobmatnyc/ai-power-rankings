import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #183 B-2 step 2: the tool page's "Models it runs" / "Harnesses for this model" block.
 *
 * Why: the block must list right-kind active links in the page's locale, emit a source
 *   href only for an http(s) URL, render nothing when there are no links, and never take
 *   the page down when the links read fails.
 * What: component tests render `ToolLinksBlock` directly (rows, none, unsafe URLs). Page
 *   tests render the real tool page to static HTML with `getDb` pointed at a PGlite
 *   database at 0016 (`displayDb`); the ranking and news reads find no tables and fall
 *   back as they do in production. `server-only` and `unstable_cache` are stubbed.
 * Test: `npx vitest run tests/unit/tool-links-page-183.test.tsx`. No server, no network.
 */

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => holder.db }));
vi.mock("next/cache", () => ({
  unstable_cache: <R,>(fn: () => Promise<R>) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

import { ToolLinksBlock, type ToolLinksLabels } from "../../components/tools/tool-links-block";
import type { ToolLinkEntry } from "../../lib/tools/tool-links";
import en from "../../i18n/dictionaries/en.json";
import de from "../../i18n/dictionaries/de.json";
import { displayDb, OPUS_SOURCE, SCRIPT_SOURCE } from "./fixtures/tool-links-display-183-fixture";

vi.setConfig({ testTimeout: 60_000 });

const LABELS: ToolLinksLabels = en.tools.detail.links;

const entry = (slug: string, name: string, relation: "native" | "supports", sourceUrl: string | null): ToolLinkEntry => ({
  slug,
  name,
  relation,
  sourceUrl,
});

const block = (props: Partial<Parameters<typeof ToolLinksBlock>[0]>) =>
  renderToStaticMarkup(
    <ToolLinksBlock lang="en" direction="models" links={[]} labels={LABELS} {...props} />
  );

const items = (html: string) =>
  [...html.matchAll(/<li data-tool-link="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => ({ slug: m[1]!, body: m[2]! }));

describe("#183 ToolLinksBlock component", () => {
  it("renders the heading, internal links in the locale, the relation and an external source link", () => {
    const html = block({
      lang: "de",
      links: [entry("opus-4-6", "Opus 4.6", "native", OPUS_SOURCE), entry("sonnet-4-5", "Sonnet 4.5", "supports", null)],
    });
    expect(html).toContain(`>${LABELS.modelsHeading}</h2>`);
    expect(html).not.toContain(LABELS.harnessesHeading);
    const [opus, sonnet] = items(html);
    expect(opus!.slug).toBe("opus-4-6");
    expect(opus!.body).toContain('href="/de/tools/opus-4-6"');
    expect(opus!.body).toContain(`>${LABELS.native}</span>`);
    expect(opus!.body).toContain(
      `<a href="${OPUS_SOURCE}" target="_blank" rel="noopener noreferrer nofollow" class="text-sm text-muted-foreground hover:underline">${LABELS.source}</a>`
    );
    expect(sonnet!.body).toContain('href="/de/tools/sonnet-4-5"');
    expect(sonnet!.body).toContain(`>${LABELS.supports}</span>`);
    expect(sonnet!.body).not.toContain(LABELS.source); // no source URL, no source link
  });

  it("uses the harnesses heading for a model page", () => {
    const html = block({ direction: "harnesses", links: [entry("cursor", "Cursor", "supports", null)] });
    expect(html).toContain(`>${LABELS.harnessesHeading}</h2>`);
    expect(html).not.toContain(LABELS.modelsHeading);
  });

  it("renders nothing at all with no links or no direction", () => {
    expect(block({ links: [] })).toBe("");
    expect(block({ direction: "harnesses", links: [] })).toBe("");
    expect(block({ direction: null, links: [entry("cursor", "Cursor", "supports", OPUS_SOURCE)] })).toBe("");
  });

  it("source link: a stored javascript: (or other non-http) URL produces no href", () => {
    const unsafe = [SCRIPT_SOURCE, "JavaScript:alert(1)", "data:text/html,<b>x</b>", "//example.com/x", "ftp://example.com/x", " https://example.com/x", "https://exa mple.com"];
    const html = block({ links: unsafe.map((url, i) => entry(`m-${i}`, `Model ${i}`, "supports", url)) });
    expect(items(html)).toHaveLength(unsafe.length);
    expect(html).not.toContain(LABELS.source);
    expect(html).not.toMatch(/href="(?!\/en\/tools\/)/); // the only hrefs are internal tool links
    expect(html.toLowerCase()).not.toContain("javascript:");
  });
});

type Params = { lang: string; slug: string };

async function renderPage(slug: string, lang = "en"): Promise<string> {
  const { default: Page } = (await import("../../app/[lang]/tools/[slug]/page")) as unknown as {
    default: (p: { params: Promise<Params> }) => Promise<ReactElement>;
  };
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ lang, slug }) }));
}

const linksBlock = (html: string) => /<div[^>]*data-tool-links="([^"]+)"[\s\S]*?<\/section>/.exec(html);

describe("#183 links block on the server-rendered tool page", () => {
  let pg: PGlite;
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    let db: unknown;
    ({ pg, db } = await displayDb());
    holder.db = db;
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await pg.close();
  });

  it("a harness page shows the models it runs, native first, linked in the page's locale", async () => {
    const html = await renderPage("claude-code", "de");
    const found = linksBlock(html);
    expect(found?.[1]).toBe("models");
    expect(found![0]).toContain(`>${de.tools.detail.links.modelsHeading}</h2>`);
    expect(items(found![0]).map((i) => i.slug)).toEqual(["opus-4-6", "sonnet-4-5"]);
    expect(found![0]).toContain('href="/de/tools/opus-4-6"');
    expect(found![0]).toContain(`href="${OPUS_SOURCE}" target="_blank" rel="noopener noreferrer nofollow"`);
    expect(html).not.toContain("retired-model");
  });

  it("a model page shows the active harnesses that offer it", async () => {
    const found = linksBlock(await renderPage("opus-4-6"));
    expect(found?.[1]).toBe("harnesses");
    expect(found![0]).toContain(`>${en.tools.detail.links.harnessesHeading}</h2>`);
    const relations = [...found![0].matchAll(/data-tool-link="([^"]+)" data-tool-link-relation="(\w+)"/g)];
    expect(relations.map((m) => [m[1], m[2]])).toEqual([
      ["claude-code", "native"],
      ["cursor", "supports"],
    ]); // retired-harness is inactive
    expect(found![0]).toContain('href="/en/tools/claude-code"');
  });

  it("a tool with no links renders no block, no heading and no list", async () => {
    const html = await renderPage("anthropic");
    expect(html).toContain("data-tool-profile"); // the page itself rendered
    expect(html).not.toContain("data-tool-links");
    expect(html).not.toContain(en.tools.detail.links.modelsHeading);
    expect(html).not.toContain(en.tools.detail.links.harnessesHeading);
  });

  it("a stored javascript: source URL renders the entry with no href to it", async () => {
    const found = linksBlock(await renderPage("cursor"));
    const sonnet = items(found![0]).find((i) => i.slug === "sonnet-4-5");
    expect(sonnet?.body).toContain('href="/en/tools/sonnet-4-5"');
    expect(sonnet?.body).not.toContain(en.tools.detail.links.source);
    expect(found![0].toLowerCase()).not.toContain("javascript:");
  });

  it("links read failure: the page still renders without the block and logs no row content", async () => {
    await pg.exec(`DROP TABLE public."tool_links"`);
    const html = await renderPage("claude-code");
    expect(html).toContain("data-tool-profile");
    expect(html).toContain("Claude Code");
    expect(html).not.toContain("data-tool-links");
    const logged = errors.mock.calls.filter(([first]) => first === "Tool page: tool links unavailable:");
    expect(logged).toHaveLength(1);
    expect(logged[0]![1]).toEqual({ slug: "claude-code", error: expect.any(String), code: "42P01" });
    const text = JSON.stringify(logged);
    for (const content of ["Opus", "Sonnet", "example.com", "select"]) expect(text).not.toContain(content);
  });
});
