/**
 * Read-only enforcement for the database side of the v7.9 → v7.10 compare (#101).
 * No database: the Neon driver is mocked so the test sees the exact
 * transaction options the driver would send.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.fn();
const sqlCall = vi.fn((text: string, params: unknown[]) => ({ text, params }));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => Object.assign(sqlCall, { transaction }),
}));

import {
  ACTIVE_TOOLS_QUERY,
  assertSelectOnly,
  loadActiveToolsReadOnly,
  neonReadOnlyRunner,
  runReadOnly,
  type ReadOnlyRunner,
} from "./ranking-compare-db-source";

const ROW = { id: "t1", name: "Tool One", slug: "tool-one", category: "ide", status: "active", data: { a: 1 } };

beforeEach(() => {
  transaction.mockReset();
  sqlCall.mockClear();
});

describe("neonReadOnlyRunner", () => {
  it("opens every statement as a READ ONLY transaction", async () => {
    transaction.mockResolvedValue([[ROW]]);
    const tools = await loadActiveToolsReadOnly(neonReadOnlyRunner("unused"));

    expect(transaction).toHaveBeenCalledTimes(1);
    const [queries, options] = transaction.mock.calls[0]!;
    expect(options).toEqual({ readOnly: true });
    expect(queries).toEqual([{ text: ACTIVE_TOOLS_QUERY, params: ["active"] }]);
    // No statement ran outside the transaction.
    expect(sqlCall).toHaveBeenCalledTimes(1);
    expect(tools).toEqual([ROW]);
  });
});

describe("runReadOnly", () => {
  it.each([
    "INSERT INTO tools (name) VALUES ('x')",
    "UPDATE tools SET name = 'x'",
    "DELETE FROM tools",
    "DROP TABLE tools",
    "CREATE TABLE t (id int)",
    "SELECT 1; DELETE FROM tools",
    "WITH gone AS (DELETE FROM tools RETURNING id) SELECT * FROM gone",
    "SET default_transaction_read_only = off",
  ])("rejects %s before it reaches the database", async (statement) => {
    const runner = vi.fn<ReadOnlyRunner>();
    await expect(runReadOnly(runner, statement, [])).rejects.toThrow(/not a single SELECT/);
    expect(runner).not.toHaveBeenCalled();
  });

  it("passes a SELECT through with readOnly: true", async () => {
    const runner = vi.fn<ReadOnlyRunner>().mockResolvedValue([]);
    await runReadOnly(runner, "SELECT 1", []);
    expect(runner).toHaveBeenCalledWith("SELECT 1", [], { readOnly: true });
  });

  it("the compare's own query is a single SELECT", () => {
    expect(() => assertSelectOnly(ACTIVE_TOOLS_QUERY)).not.toThrow();
  });
});
