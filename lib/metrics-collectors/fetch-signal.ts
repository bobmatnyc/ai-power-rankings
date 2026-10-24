/**
 * Per-fetch abort signal shared by the metrics collectors (#95).
 *
 * Why: no collector fetch had a timeout, so one hung registry call could hold a
 *   cron invocation until Vercel killed it, with nothing recorded.
 * What: every fetch gets a 10 s `AbortSignal.timeout`. A caller signal (the cron
 *   route's run deadline) joins it through `AbortSignal.any`, so both stop the fetch.
 *   `abortableSleep` is the matching wait: the caller signal ends it early.
 * Test: `tests/unit/metrics-collectors-95.test.ts`
 */

export const FETCH_TIMEOUT_MS = 10_000;

/** Options every collector constructor accepts. The CLIs pass none. */
export interface CollectorOptions {
  /** Aborts every in-flight and later fetch, e.g. at the cron run deadline. */
  signal?: AbortSignal;
}

/** A fresh signal for one fetch: the per-fetch timeout, joined with `external` if given. */
export function fetchSignal(external?: AbortSignal, timeoutMs: number = FETCH_TIMEOUT_MS): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return external ? AbortSignal.any([timeout, external]) : timeout;
}

/** Sleeps `ms`, or less if `signal` aborts first. With no signal it sleeps the full `ms`. */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
