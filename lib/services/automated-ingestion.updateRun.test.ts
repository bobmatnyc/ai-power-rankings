import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for AutomatedIngestionService.updateRun()'s completedAt stamping.
 *
 * Why: updateRun() remaps a "partial" run status to "completed" for storage
 * (the automated_ingestion_runs.status column only supports
 * "running" | "completed" | "failed" - see AutomatedIngestionRunStatus in
 * lib/db/schema.ts). A prior version of the completedAt check re-tested
 * `updates.status` AFTER that remap had already run, so it saw "completed"
 * for what really was a completed-with-errors run... except the check ran
 * against the pre-remap value and never matched "partial" at all, leaving
 * completedAt NULL on every partial run stored in the database (issue #104).
 * Confirmed against 2026-07-18 through 2026-07-30 rows where every
 * completed_at=NULL row had a non-empty error_log.
 *
 * What: Mocks getDb() from lib/db/connection so no real database is touched,
 * and asserts the object passed to `.set()` for a partial run has both
 * status:"completed" (unchanged storage behavior) and a non-null completedAt.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.updateRun.test.ts`.
 *
 * Note on the mock path: tsconfig.json excludes test files (*.test.ts) from
 * `include`, so vite-tsconfig-paths cannot resolve the "@/..." alias from
 * within this test file - vi.mock("@/lib/db/connection", ...) would register
 * under an unresolved key that never matches the fully-resolved absolute
 * path the (included, non-test) service file resolves the same alias to, so
 * the mock silently never applies and the real getDb() runs instead. Using
 * the relative path resolves identically from both sides.
 */

// vi.mock() factories are hoisted above the rest of the module, including
// ordinary `const` declarations, so any mock state the factory closes over
// must itself be created via vi.hoisted() - a plain `const setMock = vi.fn()`
// placed above vi.mock() is NOT actually hoisted with it and throws a
// temporal-dead-zone ReferenceError inside the factory.
const { setMock, returningMock } = vi.hoisted(() => ({
  setMock: vi.fn(),
  returningMock: vi.fn().mockResolvedValue([{ id: "run-1" }]),
}));

vi.mock("../db/connection", () => ({
  getDb: () => ({
    update: () => ({
      set: (data: Record<string, unknown>) => {
        setMock(data);
        return {
          where: () => ({
            returning: returningMock,
          }),
        };
      },
    }),
  }),
}));

import { AutomatedIngestionService } from "./automated-ingestion.service";

describe("AutomatedIngestionService.updateRun - completedAt stamping", () => {
  let service: AutomatedIngestionService;

  beforeEach(() => {
    setMock.mockClear();
    returningMock.mockClear();
    service = new AutomatedIngestionService();
  });

  it("stamps completedAt (non-null) when a run finishes partial", async () => {
    await service.updateRun("run-1", {
      status: "partial",
      articlesIngested: 2,
      errors: ["Failed to ingest https://example.com/a"],
    });

    expect(setMock).toHaveBeenCalledTimes(1);
    const persisted = setMock.mock.calls[0]?.[0] as {
      status?: string;
      completedAt?: Date;
    };

    // Storage still maps "partial" -> "completed" (the column has no
    // "partial" value), but the run has finished, so completedAt must be set.
    expect(persisted.status).toBe("completed");
    expect(persisted.completedAt).toBeInstanceOf(Date);
    expect(persisted.completedAt).not.toBeNull();
  });

  it("still stamps completedAt for a fully completed run", async () => {
    await service.updateRun("run-1", { status: "completed", articlesIngested: 5 });

    const persisted = setMock.mock.calls[0]?.[0] as {
      status?: string;
      completedAt?: Date;
    };
    expect(persisted.status).toBe("completed");
    expect(persisted.completedAt).toBeInstanceOf(Date);
  });

  it("still stamps completedAt for a failed run", async () => {
    await service.updateRun("run-1", { status: "failed", errors: ["boom"] });

    const persisted = setMock.mock.calls[0]?.[0] as {
      status?: string;
      completedAt?: Date;
    };
    expect(persisted.status).toBe("failed");
    expect(persisted.completedAt).toBeInstanceOf(Date);
  });

  it("does not stamp completedAt for a run still in progress", async () => {
    await service.updateRun("run-1", { articlesDiscovered: 10 });

    const persisted = setMock.mock.calls[0]?.[0] as {
      status?: string;
      completedAt?: Date;
    };
    expect(persisted.status).toBeUndefined();
    expect(persisted.completedAt).toBeUndefined();
  });
});
