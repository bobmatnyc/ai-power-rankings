/**
 * One run of the open-weight model metrics collection (#184, folds in #95).
 *
 * Why: model metrics must land in the same history store as every other
 *   collector, but the open-weight set is small (about 25 rows), so it needs no shards,
 *   and it must stay out of the scheduled /api/cron/collect-metrics run until the owner
 *   wires it in. This runner has no route and no registry entry: only a script calls it.
 * What: lists the `kind='model'`, `open_weight=true` tools that have an `hf_repo`, collects
 *   each, and upserts one history row per found model under the `huggingface` key. A tool
 *   whose collect throws counts `failed`; a 404 counts `not_found`; a deadline counts
 *   `skipped_timeout`; none of them writes a row. Status is `ok` only when every model was
 *   recorded; any failed, missing or skipped model makes it `partial`; nothing recorded
 *   from a non-empty set, an empty set, or a fatal store error, makes it `failed`. recorded + not_found +
 *   failed + skipped_timeout = attempted always holds. The result goes to
 *   the run ledger (collector `huggingface-models`); a ledger throw is reported.
 * Test: `tests/unit/metrics-open-weight-run-184.test.ts`
 */

import { abortableSleep } from "../metrics-collectors/fetch-signal";
import { HF_METRICS_KEY, type ModelMetricLeaves } from "../metrics-collectors/huggingface";
import { collectionDay, type HistoryRow } from "./collect-shard";

export const OPEN_WEIGHT_COLLECTOR = "huggingface-models";
export const OPEN_WEIGHT_DEADLINE_MS = 270_000;
const PAUSE_MS = 500;

export interface OpenWeightModel {
  id: string;
  slug: string;
  hfRepo: string;
}

export interface OpenWeightCounts {
  attempted: number;
  recorded: number;
  not_found: number;
  failed: number;
  skipped_timeout: number;
}

export type OpenWeightStatus = "ok" | "partial" | "failed";

export interface OpenWeightRunResult {
  collectedDate: string;
  period: string;
  status: OpenWeightStatus;
  counts: OpenWeightCounts;
  error: string | null;
  startedAt: Date;
  finishedAt: Date;
}

export interface OpenWeightStore {
  listModels(): Promise<OpenWeightModel[]>;
  upsertMetrics(row: HistoryRow): Promise<void>;
  recordRun(result: OpenWeightRunResult): Promise<void>;
}

export interface OpenWeightDeps {
  store: OpenWeightStore;
  /** Leaves for one repo, null on 404, throws on any other failure. */
  collect: (hfRepo: string, signal: AbortSignal) => Promise<ModelMetricLeaves | null>;
  /** When true, collect and report but write nothing (no history row, no ledger row). */
  dryRun?: boolean;
  now?: () => number;
  deadlineMs?: number;
  pause?: (signal: AbortSignal) => Promise<void>;
}

export interface OpenWeightOutcome {
  result: OpenWeightRunResult;
  /** null when the ledger row was written (always null on a dry run). */
  ledgerError: string | null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Runs the collection once. Never throws. */
export async function runOpenWeightCollection(deps: OpenWeightDeps): Promise<OpenWeightOutcome> {
  const now = deps.now ?? Date.now;
  const deadlineMs = deps.deadlineMs ?? OPEN_WEIGHT_DEADLINE_MS;
  const pause = deps.pause ?? ((signal) => abortableSleep(PAUSE_MS, signal));
  const startMs = now();
  const deadline = startMs + deadlineMs;
  const { collectedDate, period } = collectionDay(startMs);
  const counts: OpenWeightCounts = { attempted: 0, recorded: 0, not_found: 0, failed: 0, skipped_timeout: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("run deadline reached")), deadlineMs);
  const pastDeadline = () => controller.signal.aborted || now() >= deadline;

  let status: OpenWeightStatus = "ok";
  let error: string | null = null;
  let done = 0;

  try {
    const models = (await deps.store.listModels()).sort((a, b) => a.slug.localeCompare(b.slug));
    counts.attempted = models.length;
    // #184: an empty set means the seed is not loaded; that is a failed run, not a clean one.
    if (models.length === 0) throw new Error("no open-weight model with an hf_repo to collect");

    for (const model of models) {
      if (pastDeadline()) {
        counts.skipped_timeout += models.length - done;
        break;
      }
      let leaves: ModelMetricLeaves | null = null;
      let failure: string | null = null;
      try {
        leaves = await deps.collect(model.hfRepo, controller.signal);
      } catch (collectError) {
        failure = message(collectError);
      }

      if (pastDeadline()) {
        // #184: an aborted fetch is not a result; write nothing for this model.
        counts.skipped_timeout++;
      } else if (failure !== null) {
        counts.failed++;
        error ??= `${model.slug}: ${failure}`;
      } else if (leaves === null) {
        counts.not_found++;
      } else {
        if (!deps.dryRun) {
          // A store throw propagates: the run fails rather than reporting a row it did not write.
          await deps.store.upsertMetrics({
            toolId: model.id,
            toolSlug: model.slug,
            collectedDate,
            period,
            metrics: { [HF_METRICS_KEY]: leaves },
          });
        }
        counts.recorded++;
      }
      done++;
      if (done < models.length) await pause(controller.signal);
    }

    if (counts.attempted > 0 && counts.recorded === 0 && counts.skipped_timeout < counts.attempted) {
      status = "failed";
    } else if (counts.not_found > 0 || counts.failed > 0 || counts.skipped_timeout > 0) {
      status = "partial";
    }
  } catch (fatal) {
    status = "failed";
    error = message(fatal);
    counts.failed += counts.attempted - (counts.recorded + counts.not_found + counts.failed + counts.skipped_timeout);
  } finally {
    clearTimeout(timer);
  }

  const result: OpenWeightRunResult = {
    collectedDate,
    period,
    status,
    counts,
    error,
    startedAt: new Date(startMs),
    finishedAt: new Date(now()),
  };

  let ledgerError: string | null = null;
  if (!deps.dryRun) {
    try {
      await deps.store.recordRun(result);
    } catch (ledgerFailure) {
      ledgerError = message(ledgerFailure);
    }
  }
  return { result, ledgerError };
}
