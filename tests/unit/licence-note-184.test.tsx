import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #184 (owner ruling D88): the non-commercial licence note on the two MiniMax tool pages.
 *
 * Why: `minimax` and `minimax-base-2` stay listed, so their pages must say the weights are
 *   non-commercial and link the licence; every other tool page must render as before.
 * What: unit tests of `licenceNoteFor` and `LicenceNoteBlock`, a locale check over all ten
 *   dictionaries, and page tests that render the real tool page to static HTML on a PGlite
 *   catalogue at 0016 (as `tool-links-page-183.test.tsx` does).
 * Test: `npx vitest run tests/unit/licence-note-184.test.tsx`. No server, no network.
 */

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => holder.db }));
vi.mock("next/cache", () => ({
  unstable_cache: <R,>(fn: () => Promise<R>) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

import { LicenceNoteBlock } from "../../components/tools/licence-note-block";
import { LICENCE_NOTES, licenceNoteFor } from "../../lib/tools/licence-notes";
import { linkedDb } from "./fixtures/tool-links-183-fixture";
import en from "../../i18n/dictionaries/en.json";
import de from "../../i18n/dictionaries/de.json";
import es from "../../i18n/dictionaries/es.json";
import fr from "../../i18n/dictionaries/fr.json";
import hr from "../../i18n/dictionaries/hr.json";
import it_ from "../../i18n/dictionaries/it.json";
import ja from "../../i18n/dictionaries/ja.json";
import ko from "../../i18n/dictionaries/ko.json";
import uk from "../../i18n/dictionaries/uk.json";
import zh from "../../i18n/dictionaries/zh.json";

vi.setConfig({ testTimeout: 60_000 });

const M27_LICENCE = "https://huggingface.co/MiniMaxAI/MiniMax-M2.7/raw/main/LICENSE";
const M31_LICENCE = "https://huggingface.co/MiniMaxAI/MiniMax-M3.1-Flash/raw/main/LICENSE";
const NOTE_RE = /<div[^>]*data-licence-note[\s\S]*?<\/section>/;

describe("#184 licenceNoteFor", () => {
  it("lists exactly the two MiniMax slugs, each with its own licence URL", () => {
    expect(Object.keys(LICENCE_NOTES).sort()).toEqual(["minimax", "minimax-base-2"]);
    expect(licenceNoteFor("minimax-base-2")?.licenceUrl).toBe(M27_LICENCE);
    expect(licenceNoteFor("minimax")?.licenceUrl).toBe(M31_LICENCE);
  });

  it("returns null for any other slug, including object-prototype names", () => {
    for (const slug of ["minimax-base", "opus-4-6", "", "constructor", "__proto__", "toString"]) {
      expect(licenceNoteFor(slug)).toBeNull();
    }
  });
});

describe("#184 LicenceNoteBlock", () => {
  it("renders a labelled section with the note and an external licence link", () => {
    const html = renderToStaticMarkup(
      <LicenceNoteBlock name="MiniMax M2" note={licenceNoteFor("minimax-base-2")} labels={en.tools.detail.licenceNote} />
    );
    expect(html).toContain('<section aria-labelledby="tool-licence-note"');
    expect(html).toContain('<h2 id="tool-licence-note" class="text-lg font-semibold text-foreground">Licence</h2>');
    expect(html).toContain(
      "The weights of MiniMax M2 are released under the MiniMax Non-Commercial License, a non-commercial licence. Commercial use needs permission from MiniMax."
    );
    expect(html).toContain(`<a href="${M27_LICENCE}" target="_blank" rel="noopener noreferrer nofollow"`);
    expect(html).toContain(">Read the licence</a>");
  });

  it("renders nothing without a note", () => {
    expect(renderToStaticMarkup(<LicenceNoteBlock name="X" note={null} labels={en.tools.detail.licenceNote} />)).toBe("");
  });

  it("inserts a name literally, even one holding a replacement pattern", () => {
    const html = renderToStaticMarkup(
      <LicenceNoteBlock name="A $& B" note={licenceNoteFor("minimax")} labels={en.tools.detail.licenceNote} />
    );
    expect(html).toContain("The weights of A $&amp; B are released under the MiniMax Community License");
  });
});

describe("#184 locale labels", () => {
  const dicts = { en, de, es, fr, hr, it: it_, ja, ko, uk, zh };
  it.each(Object.entries(dicts))("%s has a complete licenceNote with every placeholder", (_, dict) => {
    const labels = dict.tools.detail.licenceNote;
    for (const key of ["heading", "body", "link"] as const) expect(labels[key].trim()).not.toBe("");
    for (const token of ["{name}", "{licence}", "{vendor}"]) expect(labels.body).toContain(token);
  });
});

type Params = { lang: string; slug: string };

async function renderPage(slug: string, lang = "en"): Promise<string> {
  const { default: Page } = (await import("../../app/[lang]/tools/[slug]/page")) as unknown as {
    default: (p: { params: Promise<Params> }) => Promise<ReactElement>;
  };
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ lang, slug }) }));
}

describe("#184 licence note on the server-rendered tool page", () => {
  let pg: PGlite;

  beforeEach(async () => {
    let db: unknown;
    ({ pg, db } = await linkedDb([
      { slug: "minimax", name: "MiniMax", kind: "model" },
      { slug: "minimax-base-2", name: "MiniMax M2", kind: "model" },
      { slug: "minimax-base", name: "MiniMax M", kind: "model" },
      { slug: "opus-4-6", name: "Opus 4.6", kind: "model" },
      { slug: "claude-code", name: "Claude Code", kind: "harness" },
    ]));
    holder.db = db;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await pg.close();
  });

  it.each([
    ["minimax-base-2", "MiniMax M2", "MiniMax Non-Commercial License", M27_LICENCE],
    ["minimax", "MiniMax", "MiniMax Community License", M31_LICENCE],
  ])("%s shows the note above the profile block, linking its licence", async (slug, name, licence, url) => {
    const html = await renderPage(slug);
    const note = NOTE_RE.exec(html)?.[0];
    expect(note).toBeDefined();
    expect(note).toContain(`The weights of ${name} are released under the ${licence}, a non-commercial licence.`);
    expect(note).toContain("Commercial use needs permission from MiniMax.");
    expect(note).toContain(`href="${url}"`);
    expect(html.indexOf("data-licence-note")).toBeLessThan(html.indexOf("data-tool-profile"));
  });

  it("a non-English page shows the note in its locale", async () => {
    const html = await renderPage("minimax-base-2", "de");
    const note = NOTE_RE.exec(html)?.[0];
    expect(note).toContain(`>${de.tools.detail.licenceNote.heading}</h2>`);
    expect(note).toContain("Die Gewichte von MiniMax M2 stehen unter der MiniMax Non-Commercial License");
    expect(note).toContain(`>${de.tools.detail.licenceNote.link}</a>`);
  });

  it.each(["minimax-base", "opus-4-6", "claude-code"])("%s renders no note", async (slug) => {
    const html = await renderPage(slug);
    expect(html).toContain("data-tool-profile"); // the page itself rendered
    expect(html).not.toContain("data-licence-note");
    expect(html).not.toContain("tool-licence-note");
    expect(html).not.toContain(en.tools.detail.licenceNote.link);
    expect(html).not.toContain("huggingface.co/MiniMaxAI");
  });
});
