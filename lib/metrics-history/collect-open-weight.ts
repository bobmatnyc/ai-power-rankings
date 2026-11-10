/**
 * One run of the open-weight model collection (#184).
 *
 * Why: model downloads and likes must land in the same history store as the other collectors,
 *   but the set is small (about 25 rows) and must stay out of the scheduled collect-metrics
 *   cron and out of scoring. This runner has no route and no registry entry; only a script calls it.
 * What: lists `kind='model'` tools with an `hf_repo`, collects them with bounded concurrency
 *   (default 4 workers), and upserts one history row per found model under the `huggingface` key.
 *   A collect that throws counts `failed`, a 404 counts `not_found`, a model not started or cut
 *   off by the deadline counts `skipped_timeout`; none of them writes a row. Status is `ok` only
 *   when every model was recorded, `failed` when none was or the set is empty or the store throws,
 *   else `partial`. recorded + not_found + failed + skipped_timeout = attempted always holds.
 *   A dry run writes nothing. No ledger row is written.
 * Test: `tests/unit/metrics-open-weight-run-184.test.ts`
 */

import { HF_METRICS_KEY, type ModelMetricLeaves } from "../metrics-collectors/huggingface";
import { collectionDay, type HistoryRow } from "./collect-shard";

export const OPEN_WEIGHT_DEADLINE_MS = 270_000;
export const OPEN_WEIGHT_CONCURRENCY = 4;

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
  /** First failure, prefixed with the model slug. */
  error: string | null;
}

export interface OpenWeightStore {
  listModels(): Promise<OpenWeightModel[]>;
  upsertMetrics(row: HistoryRow): Promise<void>;
}

export interface OpenWeightDeps {
  store: OpenWeightStore;
  /** Leaves for one repo, null on 404, throws on any other failure. */
  collect: (hfRepo: string, signal: AbortSignal) => Promise<ModelMetricLeaves | null>;
  /** When true, collect and report but write nothing. */
  dryRun?: boolean;
  now?: () => number;
  deadlineMs?: number;
  concurrency?: number;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Runs the collection once. Never throws. */
export async function runOpenWeightCollection(deps: OpenWeightDeps): Promise<OpenWeightRunResult> {
  const now = deps.now ?? Date.now;
  const deadlineMs = deps.deadlineMs ?? OPEN_WEIGHT_DEADLINE_MS;
  const workers = Math.max(1, deps.concurrency ?? OPEN_WEIGHT_CONCURRENCY);
  const startMs = now();
  const { collectedDate, period } = collectionDay(startMs);
  const counts: OpenWeightCounts = { attempted: 0, recorded: 0, not_found: 0, failed: 0, skipped_timeout: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("run deadline reached")), deadlineMs);
  const pastDeadline = () => controller.signal.aborted || now() >= startMs + deadlineMs;

  let status: OpenWeightStatus = "ok";
  let error: string | null = null;

  try {
    const models = (await deps.store.listModels()).sort((a, b) => a.slug.localeCompare(b.slug));
    counts.attempted = models.length;
    // #184: an empty set means the seed is not loaded; that is a failed run, not a clean one.
    if (models.length === 0) throw new Error("no model with an hf_repo to collect");

    let next = 0;
    let fatalError: unknown = null;
    const worker = async (): Promise<void> => {
      while (next < models.length && fatalError === null) {
        const model = models[next++] as OpenWeightModel;
        if (pastDeadline()) {
          counts.skipped_timeout++;
          continue;
        }
        let leaves: ModelMetricLeaves | null = null;
        let failure: string | null = null;
        try {
          leaves = await deps.collect(model.hfRepo, controller.signal);
        } catch (collectError) {
          failure = message(collectError);
        }
        if (failure !== null && controller.signal.aborted) {
          // #184: a fetch cut off by the run deadline is not a result; write nothing for this model.
          counts.skipped_timeout++;
        } else if (failure !== null) {
          counts.failed++;
          error ??= `${model.slug}: ${failure}`;
        } else if (leaves === null) {
          counts.not_found++;
        } else {
          if (!deps.dryRun) {
            try {
              await deps.store.upsertMetrics({
                toolId: model.id,
                toolSlug: model.slug,
                collectedDate,
                period,
                metrics: { [HF_METRICS_KEY]: leaves },
              });
            } catch (storeError) {
              // A store throw is fatal: the run fails rather than reporting a row it did not write.
              fatalError = storeError;
              break;
            }
          }
          counts.recorded++;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(workers, models.length) }, worker));
    if (fatalError !== null) throw fatalError;

    if (counts.recorded === 0 && counts.skipped_timeout < counts.attempted) status = "failed";
    else if (counts.not_found > 0 || counts.failed > 0 || counts.skipped_timeout > 0) status = "partial";
  } catch (fatal) {
    status = "failed";
    error = message(fatal);
    // Models not yet counted (a store throw stops the run) count as failed.
    counts.failed += counts.attempted - (counts.recorded + counts.not_found + counts.failed + counts.skipped_timeout);
  } finally {
    clearTimeout(timer);
  }

  return { collectedDate, period, status, counts, error };
}
