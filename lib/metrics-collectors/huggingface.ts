/**
 * Hugging Face Hub collector for open-weight model metrics (#184, folds in #95).
 *
 * Why: the open-weight models (kind `model`, `open_weight = true`) have no npm, PyPI or
 *   GitHub footprint to collect. The Hub's public model API carries their licence, size,
 *   download and like counts, and community-submitted benchmark results.
 * What: `fetchModelMetrics(repo)` makes one unauthenticated GET and returns metric leaves
 *   (`{ value, source, as_of }`), or `null` when the Hub answers 404. It throws on every
 *   other failure (401/403, 429, 5xx, a network error, a timeout, a body that is not the
 *   expected shape); the caller counts that tool as failed. A field the Hub does not return
 *   gets no leaf; nothing is ever defaulted to 0. Needs no token (the repo's GITHUB_TOKEN
 *   rule does not apply here). Benchmarks become `benchmark:<dataset>:<task>` leaves that
 *   keep the submitter's own source and date in `origin`, and carry the flag `unverified`
 *   unless the Hub marks the result verified.
 * Test: `tests/unit/metrics-huggingface-184.test.ts`
 */

import { type CollectorOptions, fetchSignal } from "./fetch-signal";

/** Leaf `source` for every value this collector writes. */
export const HF_SOURCE = "huggingface-hub-api";

/** Top-level key of the history row's `metrics` object owned by this collector. */
export const HF_METRICS_KEY = "huggingface";

const HUB_MODEL_URL = "https://huggingface.co/api/models/";
const EXPAND = ["downloads", "likes", "safetensors", "evalResults", "lastModified", "gated", "cardData"];

/** A metric leaf as the history store keeps it; a benchmark leaf also keeps where the submitter says the number came from. */
export interface ModelMetricLeaf {
  value: unknown;
  source: string;
  as_of: string;
  flags?: string[];
  origin?: { url: string | null; name: string | null; date: string | null };
}

export type ModelMetricLeaves = Record<string, ModelMetricLeaf>;

export interface HuggingFaceOptions extends CollectorOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** A repo id is `owner/name`; anything else is refused before it reaches a URL. */
export function isValidRepoId(repo: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repo);
}

export class HuggingFaceModelCollector {
  private readonly signal: AbortSignal | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: HuggingFaceOptions = {}) {
    this.signal = options.signal;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  /** Leaves for one repo, or null when the Hub says 404. Throws on any other failure. */
  async fetchModelMetrics(repo: string): Promise<ModelMetricLeaves | null> {
    // #184: a malformed id is a seed error; fail the tool instead of building a URL from it.
    if (!isValidRepoId(repo)) throw new Error(`invalid Hugging Face repo id: ${JSON.stringify(repo)}`);
    const query = EXPAND.map((field) => `expand[]=${field}`).join("&");
    const response = await this.fetchImpl(`${HUB_MODEL_URL}${repo}?${query}`, {
      headers: { Accept: "application/json" },
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
    if (!isRecord(body)) throw new Error("Hugging Face Hub returned an unexpected body shape");
    return this.toLeaves(body);
  }

  private toLeaves(body: Record<string, unknown>): ModelMetricLeaves {
    const asOf = this.now().toISOString();
    const leaves: ModelMetricLeaves = {};
    const add = (key: string, value: unknown) => {
      leaves[key] = { value, source: HF_SOURCE, as_of: asOf };
    };

    // #184: the Hub always sends these counts; a missing or non-numeric one is a bad response, not a 0.
    for (const [field, key] of [
      ["downloads", "downloads_30d"],
      ["likes", "likes"],
    ] as const) {
      const value = body[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(`Hugging Face Hub response has no usable ${field}`);
      }
      add(key, value);
    }

    const card = isRecord(body["cardData"]) ? body["cardData"] : {};
    const licence = str(card["license"]);
    if (licence) add("license", licence);
    const modified = str(body["lastModified"]);
    if (modified) add("last_modified", modified);
    const gated = body["gated"];
    if (typeof gated === "boolean" || typeof gated === "string") add("gated", gated);

    const safetensors = isRecord(body["safetensors"]) ? body["safetensors"] : {};
    const total = safetensors["total"];
    if (typeof total === "number" && Number.isFinite(total) && total > 0) add("parameters_total", total);

    this.addBenchmarks(leaves, body["evalResults"], asOf);
    return leaves;
  }

  private addBenchmarks(leaves: ModelMetricLeaves, evalResults: unknown, asOf: string): void {
    if (!Array.isArray(evalResults)) return;
    const newest = new Map<string, { leaf: ModelMetricLeaf; date: string }>();
    for (const entry of evalResults) {
      if (!isRecord(entry) || !isRecord(entry["data"])) continue;
      const data = entry["data"];
      const dataset = isRecord(data["dataset"]) ? data["dataset"] : {};
      const datasetId = str(dataset["id"]);
      if (!datasetId) continue;
      const key = `benchmark:${datasetId}:${str(dataset["task_id"]) ?? "default"}`;
      const source = isRecord(data["source"]) ? data["source"] : {};
      const date = str(data["date"]);
      const leaf: ModelMetricLeaf = {
        value: data["value"],
        source: HF_SOURCE,
        as_of: asOf,
        origin: { url: str(source["url"]), name: str(source["name"]), date },
      };
      const flags: string[] = [];
      if (typeof data["value"] !== "number" || !Number.isFinite(data["value"])) flags.push("non_numeric");
      if (entry["verified"] !== true) flags.push("unverified");
      if (flags.length > 0) leaf.flags = flags;
      // Several submissions can score the same dataset and task; keep the newest.
      const known = newest.get(key);
      if (!known || (date ?? "") > known.date) newest.set(key, { leaf, date: date ?? "" });
    }
    for (const [key, { leaf }] of [...newest].sort(([a], [b]) => a.localeCompare(b))) leaves[key] = leaf;
  }
}
