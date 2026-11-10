/**
 * Hugging Face Hub collector for open-weight model downloads and likes (#184).
 *
 * Why: open-weight models (kind `model`, `hf_repo` set) have no npm, PyPI or GitHub
 *   footprint. The Hub's public model API carries their download and like counts.
 * What: `fetchModelMetrics(repo)` makes one GET with a 10 s timeout and returns two history
 *   leaves, `downloads_30d` and `likes`, each `{ value, source, as_of }` where `source` is the
 *   API URL asked. It returns `null` on a 404 and throws on every other failure (401, 403, 429,
 *   5xx, network error, timeout, a body that is not JSON, a count that is missing or not a
 *   non-negative number). A failure is never defaulted to 0. The token is optional: when
 *   `HF_TOKEN` is set it is sent as a bearer header, otherwise the call is anonymous.
 * Test: `tests/unit/metrics-huggingface-184.test.ts`
 */

import { type CollectorOptions, fetchSignal } from "./fetch-signal";

const HUB_MODEL_URL = "https://huggingface.co/api/models/";

/** Top-level key of the history row's `metrics` object owned by this collector. */
export const HF_METRICS_KEY = "huggingface";

/** The leaf shape the history store keeps, declared here so this file imports nothing from the history code. */
export interface ModelMetricLeaf {
  value: unknown;
  source: string;
  as_of: string;
}

export type ModelMetricLeaves = Record<string, ModelMetricLeaf>;

export interface HuggingFaceOptions extends CollectorOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Optional Hub token. Omitted or empty means anonymous calls. */
  token?: string | undefined;
}

/** A repo id is `owner/name`; anything else is refused before it reaches a URL. */
export function isValidRepoId(repo: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repo);
}

export class HuggingFaceModelCollector {
  private readonly signal: AbortSignal | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly token: string | undefined;

  constructor(options: HuggingFaceOptions = {}) {
    this.signal = options.signal;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.token = options.token ? options.token : undefined;
  }

  /** Leaves for one repo, or null when the Hub says 404. Throws on any other failure. */
  async fetchModelMetrics(repo: string): Promise<ModelMetricLeaves | null> {
    // #184: a malformed id is a seed error; fail the repo instead of building a URL from it.
    if (!isValidRepoId(repo)) throw new Error(`invalid Hugging Face repo id: ${JSON.stringify(repo)}`);
    const url = `${HUB_MODEL_URL}${repo}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const response = await this.fetchImpl(`${url}?expand[]=downloads&expand[]=likes`, {
      headers,
      signal: fetchSignal(this.signal),
    });
    if (response.status === 404) return null;
    // #184: 401 (the Hub's answer for a missing or private repo), 403, 429 and 5xx are failures, never "no data".
    if (!response.ok) throw new Error(`Hugging Face Hub returned HTTP ${response.status} for a model request`);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error("Hugging Face Hub returned a body that is not JSON");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("Hugging Face Hub returned an unexpected body shape");
    }
    const record = body as Record<string, unknown>;
    const asOf = this.now().toISOString();
    const leaves: ModelMetricLeaves = {};
    // #184: the Hub always sends these counts; a missing or non-numeric one is a bad response, not a 0.
    for (const [field, key] of [
      ["downloads", "downloads_30d"],
      ["likes", "likes"],
    ] as const) {
      const value = record[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(`Hugging Face Hub response has no usable ${field}`);
      }
      leaves[key] = { value, source: url, as_of: asOf };
    }
    return leaves;
  }
}
