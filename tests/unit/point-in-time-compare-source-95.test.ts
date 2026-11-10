/**
 * Read-only guarantee of the point-in-time compare source (#95).
 *
 * Why: the compare reads the production database from a public workflow. A write
 *   must fail, and a transaction that is not read-only must abort the run before
 *   any row is used.
 * What: (1) the Neon driver is mocked to show every statement is sent inside a
 *   `readOnly: true` transaction after the probe; (2) a probe that is not `on`
 *   rejects; (3) a non-SELECT never reaches the driver and every port write method
 *   throws; (4) on PGlite (real Postgres), a write fails inside the READ ONLY
 *   transaction, a driver that drops READ ONLY is caught by the probe, and the
 *   compare's own SQL runs against the real table shapes.
 * Test: `npx vitest run tests/unit/point-in-time-compare-source-95.test.ts`. No server, no network.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.fn();
const sqlCall = vi.fn((text: string, params: unknown[]) => ({ text, params }));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => Object.assign(sqlCall, { transaction }),
}));

import { assertSelectOnly, type ReadOnlyRunner, runReadOnly } from "../../lib/ranking-compare-db-source";
import {
  createReadOnlyComparePersistence,
  neonTransactionDriver,
  PIT_ACTIVE_TOOLS_QUERY,
  PIT_COMPARE_QUERIES,
  READ_ONLY_PROBE,
  ReadOnlyCompareWriteError,
  ReadOnlyNotAppliedError,
  type ReadOnlyTransactionDriver,
  verifiedReadOnlyRunner,
} from "../../lib/rankings/point-in-time-compare-source";

vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  transaction.mockReset();
  sqlCall.mockClear();
});

const fixedDriver =
  (readOnly: unknown, rows: Record<string, unknown>[] = [{ x: 1 }]): ReadOnlyTransactionDriver =>
  async () => [[{ read_only: readOnly }], rows];

describe("neon transaction driver (#95)", () => {
  it("sends the probe then the statement in one readOnly: true transaction", async () => {
    transaction.mockResolvedValue([[{ read_only: "on" }], [{ id: "t1" }]]);
    const rows = await runReadOnly(verifiedReadOnlyRunner(neonTransactionDriver("unused")), PIT_ACTIVE_TOOLS_QUERY, ["active"]);

    expect(rows).toEqual([{ id: "t1" }]);
    expect(transaction).toHaveBeenCalledTimes(1);
    const [queries, options] = transaction.mock.calls[0]!;
    expect(options).toEqual({ readOnly: true });
    expect(queries).toEqual([
      { text: READ_ONLY_PROBE, params: [] },
      { text: PIT_ACTIVE_TOOLS_QUERY, params: ["active"] },
    ]);
    expect(sqlCall).toHaveBeenCalledTimes(2);
  });
});

describe("verifiedReadOnlyRunner (#95)", () => {
  it("returns the rows when Postgres reports the transaction read-only", async () => {
    await expect(verifiedReadOnlyRunner(fixedDriver("on"))("SELECT 1", [], { readOnly: true })).resolves.toEqual([{ x: 1 }]);
  });

  it.each(["off", undefined, null, "true"])("aborts when transaction_read_only is %s", async (value) => {
    await expect(verifiedReadOnlyRunner(fixedDriver(value))("SELECT 1", [], { readOnly: true })).rejects.toBeInstanceOf(
      ReadOnlyNotAppliedError
    );
  });
});

describe("compare port writes nothing (#95)", () => {
  it.each(["INSERT INTO tools (name) VALUES ('x')", "UPDATE rankings SET is_current = false", "SELECT 1; DELETE FROM tools"])(
    "refuses %s before it reaches the driver",
    async (statement) => {
      const driver = vi.fn<ReadOnlyTransactionDriver>();
      await expect(runReadOnly(verifiedReadOnlyRunner(driver), statement, [])).rejects.toThrow(/not a single SELECT/);
      expect(driver).not.toHaveBeenCalled();
    }
  );

  it("every write method of the port throws and calls no runner", async () => {
    const runner = vi.fn<ReadOnlyRunner>();
    const port = createReadOnlyComparePersistence(runner);
    const input = { period: "2026-11", algorithmVersion: "8.1", publishedAt: new Date(0), data: [] };
    await expect(port.saveSnapshot(input)).rejects.toBeInstanceOf(ReadOnlyCompareWriteError);
    await expect(port.saveListSnapshots!([input])).rejects.toBeInstanceOf(ReadOnlyCompareWriteError);
    await expect(port.saveDraft!(input)).rejects.toBeInstanceOf(ReadOnlyCompareWriteError);
    expect(runner).not.toHaveBeenCalled();
  });

  it("every query the compare sends is a single SELECT", () => {
    for (const query of PIT_COMPARE_QUERIES) expect(() => assertSelectOnly(query)).not.toThrow();
  });
});

// Minimal shapes of the four tables the compare reads (columns it selects or filters on).
const SCHEMA = `
  CREATE TABLE tools (id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL, category text NOT NULL,
    status text NOT NULL, kind text NOT NULL DEFAULT 'harness', data jsonb NOT NULL DEFAULT '{}'::jsonb);
  CREATE TABLE rankings (period text NOT NULL, list text NOT NULL DEFAULT 'combined', is_current boolean NOT NULL DEFAULT false, data jsonb NOT NULL);
  CREATE TABLE tool_metrics_history (tool_id uuid, collected_date date NOT NULL, period text NOT NULL, metrics jsonb NOT NULL DEFAULT '{}'::jsonb);
  CREATE TABLE metrics_collection_runs (collected_date date NOT NULL, collector text NOT NULL, shard int NOT NULL,
    attempted int NOT NULL, recorded int NOT NULL, flagged int NOT NULL, not_found int NOT NULL, failed int NOT NULL, skipped_timeout int NOT NULL);
  INSERT INTO tools VALUES ('00000000-0000-4000-8000-000000000001', 'Alpha', 'alpha', 'code-editor', 'active', 'harness', '{"metrics":{}}');
  INSERT INTO tool_metrics_history VALUES
    ('00000000-0000-4000-8000-000000000001', '2026-10-01', '2026-10', '{"npm":{"downloads_last_month":{"value":1}}}'),
    ('00000000-0000-4000-8000-000000000001', '2026-11-01', '2026-11', '{"vscode":{"installs":{"value":2}}}'),
    (NULL, '2026-11-01', '2026-11', '{"npm":{}}');
  INSERT INTO metrics_collection_runs VALUES ('2026-11-01', 'npm', 0, 5, 3, 1, 2, 0, 0), ('2026-11-01', 'npm', 1, 4, 4, 0, 0, 0, 0);
  CREATE FUNCTION add_tool() RETURNS int LANGUAGE sql AS $$
    INSERT INTO tools (id, name, slug, category, status) VALUES (gen_random_uuid(), 'X', 'x', 'c', 'active') RETURNING 1
  $$;
`;

/** Test-only driver over PGlite. `dropReadOnly` simulates a driver that ignores the option. */
function pgliteDriver(db: PGlite, dropReadOnly = false): ReadOnlyTransactionDriver {
  return async (statements, options) => {
    await db.exec(options.readOnly && !dropReadOnly ? "BEGIN READ ONLY" : "BEGIN");
    try {
      const out: Record<string, unknown>[][] = [];
      for (const s of statements) out.push((await db.query<Record<string, unknown>>(s.text, s.params)).rows);
      await db.exec("COMMIT");
      return out;
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  };
}

describe("on real Postgres (PGlite) (#95)", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(SCHEMA);
  });
  afterEach(async () => {
    await db.close();
  });

  const toolCount = async () => (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM tools")).rows[0]!.n;

  it("a write hidden in a SELECT fails inside the READ ONLY transaction", async () => {
    const runner = verifiedReadOnlyRunner(pgliteDriver(db));
    await expect(runReadOnly(runner, "SELECT add_tool()", [])).rejects.toThrow(/read-only transaction/);
    expect(await toolCount()).toBe(1);
  });

  it("a write sent straight to the driver fails too (Postgres, not only the SELECT check)", async () => {
    await expect(
      pgliteDriver(db)([{ text: "INSERT INTO tools (id, name, slug, category, status) VALUES (gen_random_uuid(), 'X', 'x', 'c', 'active')", params: [] }], {
        readOnly: true,
      })
    ).rejects.toThrow(/read-only transaction/);
    expect(await toolCount()).toBe(1);
  });

  it("a driver that drops READ ONLY is caught by the probe and its rows are not used", async () => {
    const runner = verifiedReadOnlyRunner(pgliteDriver(db, true));
    await expect(runReadOnly(runner, PIT_ACTIVE_TOOLS_QUERY, ["active"])).rejects.toBeInstanceOf(ReadOnlyNotAppliedError);
  });

  it("the port's queries run on the real table shapes", async () => {
    const port = createReadOnlyComparePersistence(verifiedReadOnlyRunner(pgliteDriver(db)));

    expect(await port.loadActiveTools()).toEqual([
      { id: "00000000-0000-4000-8000-000000000001", name: "Alpha", slug: "alpha", category: "code-editor", status: "active", data: { metrics: {} }, kind: "harness" },
    ]);
    expect(await port.loadCurrentRankings("harness")).toBeNull();
    expect(await port.loadLatestMetricsCollectedDate("2026-10")).toBe("2026-10-01");
    expect(await port.loadLatestMetricsCollectedDate("2026-11")).toBe("2026-11-01");
    const history = await port.loadMetricsHistoryForPeriod("2026-11");
    // The null tool_id row is skipped; each part keeps its newest reading.
    expect([...history.keys()]).toEqual(["00000000-0000-4000-8000-000000000001"]);
    expect(history.get("00000000-0000-4000-8000-000000000001")!.parts).toEqual({ vscode: "2026-11-01", npm: "2026-10-01" });
    expect(await port.loadLedgerTotals("2026-11-01")).toEqual([
      { collector: "npm", attempted: 9, recorded: 7, flagged: 1, not_found: 2, failed: 0, skipped_timeout: 0 },
    ]);
  });
});
