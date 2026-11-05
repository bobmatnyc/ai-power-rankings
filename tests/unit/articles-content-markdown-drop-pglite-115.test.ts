/**
 * #115 (D6f): migration 0032 drops the orphaned `articles.content_markdown` column on the real
 * migration chain (PGlite).
 *
 * Why: production carries `content_markdown`, which no repository migration creates, so the
 *   chain never builds it. The owner ruled a plain DROP COLUMN with no CASCADE; the drop must
 *   remove the column, keep every row, and be a no-op where the column never existed.
 * What: chain 0000..0001 (they create `articles`; no later file touches `content_markdown`, and
 *   0017 needs a seed the chain fixture inserts only after the chain), add the column and rows,
 *   then run 0032 through `runMigrations --only`. A second database without the column runs it too.
 * Test: `npx vitest run tests/unit/articles-content-markdown-drop-pglite-115.test.ts`. No network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import { runMigrations } from "../../scripts/apply-migrations";
import { chainDb, MIGRATION_FILES, readMigration } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

// The chain runs migrations on PGlite, which can pass 5000 ms on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const FILE = "0032_drop_articles_content_markdown.sql";
/** chainDb applies every file before this one: 0000 and 0001, which create `articles`. */
const CHAIN_UP_TO = "0012";

async function apply(db: PGlite) {
  return runMigrations(
    { db: pgliteMigrationDb(db), files: { list: () => [...MIGRATION_FILES], read: readMigration }, log: () => {} },
    { dryRun: false, only: FILE, showColumns: null, force: false }
  );
}

async function hasColumn(db: PGlite): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'content_markdown'`
  );
  return rows.length === 1;
}

async function articleCount(db: PGlite): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.articles`);
  return rows[0]!.n;
}

async function insertArticles(db: PGlite, n: number) {
  for (let i = 0; i < n; i++) {
    await db.query(
      `INSERT INTO public.articles (slug, title, content, ingestion_type) VALUES ($1, $2, 'body', 'url')`,
      [`a-${i}`, `Article ${i}`]
    );
  }
}

describe("#115 migration 0032", () => {
  it("is plain DROP COLUMN IF EXISTS with no CASCADE", () => {
    const code = readMigration(FILE)
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim();
    expect(code).toBe("ALTER TABLE public.articles DROP COLUMN IF EXISTS content_markdown;");
    expect(code).not.toMatch(/CASCADE/i);
  });

  it("drops the column and keeps every row", async () => {
    const db = await chainDb(CHAIN_UP_TO);
    await db.exec(`ALTER TABLE public.articles ADD COLUMN content_markdown text`);
    await insertArticles(db, 5);
    await db.query(`UPDATE public.articles SET content_markdown = '# md' WHERE slug IN ('a-0', 'a-1', 'a-2')`);
    expect(await hasColumn(db)).toBe(true);

    expect((await apply(db)).exitCode).toBe(0);

    expect(await hasColumn(db)).toBe(false);
    expect(await articleCount(db)).toBe(5);
  });

  it("is a no-op when the column is absent", async () => {
    const db = await chainDb(CHAIN_UP_TO);
    await insertArticles(db, 3);
    expect(await hasColumn(db)).toBe(false);

    expect((await apply(db)).exitCode).toBe(0);

    expect(await hasColumn(db)).toBe(false);
    expect(await articleCount(db)).toBe(3);
  });
});
