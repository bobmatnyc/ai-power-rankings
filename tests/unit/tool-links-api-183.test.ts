/**
 * #183 B-2 step 2: the `links` field of `GET /api/tools/[slug]/json`, on PGlite.
 *
 * Why: the field must list the right-kind, active linked tools native first, keep every
 *   existing field, and survive a failed links read. Those are SQL and route behaviour, so
 *   the route runs against a real PGlite database at 0016 (only `getDb` is pointed at it).
 * What: calls the route's GET for a harness, a model, a tool with no links, an unknown
 *   slug, a stored `javascript:` source URL, and with `tool_links` dropped (the read fails).
 *   Fail-soft contract: on a failed read `links` is omitted (an empty set is `links: []`),
 *   the response is still 200, and the warning carries no row content.
 * Test: `npx vitest run tests/unit/tool-links-api-183.test.ts`. No server, no network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolLinksDb } from "../../lib/db/repositories/tool-links.repository";
import { loggers } from "../../lib/logger";
import { displayDb, OPUS_SOURCE, SONNET_SOURCE } from "./fixtures/tool-links-display-183-fixture";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => holder.db }));

import { GET } from "../../app/api/tools/[slug]/json/route";

vi.setConfig({ testTimeout: 60_000 });

let pg: PGlite;
beforeEach(async () => {
  let db: ToolLinksDb;
  ({ pg, db } = await displayDb());
  holder.db = db;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await pg.close();
});

async function get(slug: string) {
  const res = await GET({ nextUrl: new URL(`https://example.test/api/tools/${slug}/json`) } as never, {
    params: Promise.resolve({ slug }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

// The fields a found tool answered with before #183 B-2 step 2, when the tool has no
// ranking, history or news (as here: those tables are absent and each read is caught).
const EXISTING_KEYS = ["_source", "_timestamp", "metrics", "ranking", "tool"];
// `info` and the other optional fields are undefined for these rows, so JSON drops them;
// `kind` and `subcategory` must not appear.
const TOOL_KEYS = ["category", "id", "name", "slug", "status"];

describe("#183 GET /api/tools/[slug]/json links", () => {
  it("a harness lists the active models it runs, native first, and keeps every existing field", async () => {
    const { status, body } = await get("claude-code");
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual([...EXISTING_KEYS, "links"].sort());
    expect(Object.keys(body["tool"] as object).sort()).toEqual(TOOL_KEYS);
    expect(body["ranking"]).toBeNull();
    // retired-model is deprecated, so it is not listed; native comes before supports.
    expect(body["links"]).toEqual([
      { slug: "opus-4-6", name: "Opus 4.6", relation: "native", sourceUrl: OPUS_SOURCE },
      { slug: "sonnet-4-5", name: "Sonnet 4.5", relation: "supports", sourceUrl: SONNET_SOURCE },
    ]);
  });

  it("a model lists the active harnesses that offer it", async () => {
    const { status, body } = await get("opus-4-6");
    expect(status).toBe(200);
    // retired-harness is inactive, so it is not listed.
    expect(body["links"]).toEqual([
      { slug: "claude-code", name: "Claude Code", relation: "native", sourceUrl: OPUS_SOURCE },
      { slug: "cursor", name: "Cursor", relation: "supports", sourceUrl: null },
    ]);
  });

  it("a tool with no links answers links: []", async () => {
    const { status, body } = await get("anthropic");
    expect(status).toBe(200);
    expect(body["links"]).toEqual([]);
    expect(Object.keys(body).sort()).toEqual([...EXISTING_KEYS, "links"].sort());
  });

  it("an unknown slug keeps its 404 body and gains no links", async () => {
    const { status, body } = await get("no-such-tool");
    expect(status).toBe(404);
    expect(body).toEqual({ error: "Tool not found", message: "The requested tool could not be found." });
  });

  it("a stored javascript: source URL is answered as sourceUrl: null", async () => {
    const { body } = await get("cursor");
    expect(body["links"]).toEqual([
      { slug: "opus-4-6", name: "Opus 4.6", relation: "supports", sourceUrl: null },
      { slug: "sonnet-4-5", name: "Sonnet 4.5", relation: "supports", sourceUrl: null },
    ]);
  });

  it("a failed links read omits links, keeps the 200 and the other fields, and logs no row content", async () => {
    const warn = vi.spyOn(loggers.api, "warn");
    await pg.exec(`DROP TABLE public."tool_links"`);
    const { status, body } = await get("claude-code");
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(EXISTING_KEYS);
    expect((body["tool"] as { slug: string }).slug).toBe("claude-code");
    const linkWarnings = warn.mock.calls.filter(([message]) => message === "Failed to fetch tool links");
    expect(linkWarnings).toHaveLength(1);
    const logged = JSON.stringify(linkWarnings[0]);
    expect(logged).toContain('"code":"42P01"'); // undefined_table
    for (const content of ["Opus", "Sonnet", "example.com", "select", "tool_links"]) expect(logged).not.toContain(content);
  });
});
