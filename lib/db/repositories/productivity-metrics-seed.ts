/**
 * Productivity metrics file: the allowlist, the 0027 marker and the validator (#314, D80).
 *
 * Why: the reviewed figures in `docs/refresh/productivity-metrics.json` reach production through
 *   `scripts/load-productivity-metrics.ts`. A bad figure, an unknown key or a slug outside the
 *   nine productivity rows must stop the whole load before any database read or write.
 * What: `parseProductivityMetrics` parses the file and returns one entry per tool: the metric
 *   values with their provenance (source, as_of, scope, source_type, confidence, and unit,
 *   currency and attributed_to when given) and the info fields the ranking engine reads. It
 *   collects every error and throws one `Error` listing them all; it never returns a partial set.
 * Test: `tests/unit/productivity-metrics-loader-314.test.ts`
 */

// #314: the nine rows 0027 created; the loader writes no other slug.
export const PRODUCTIVITY_SLUGS = [
  "chatgpt",
  "gemini-app",
  "genspark",
  "grok-app",
  "hermes-agent",
  "manus",
  "microsoft-copilot",
  "mistral-vibe",
  "notion-ai",
] as const;

// #314: tools has no created_by column; 0027 writes this marker into data.createdBy.
export const PRODUCTIVITY_0027_MARKER = "migration 0027_create_productivity_rows";

export const PRODUCTIVITY_METRICS_DEFAULT_PATH = "docs/refresh/productivity-metrics.json";

// #314: the metric paths under data.metrics that lib/ranking-algorithm-v76.ts scores
// (users 869, monthly_arr 944, valuation 978, funding 979, news_mentions 888,
// github.stars 903, pypi.downloads_last_month 275). Any other key is refused.
export const PRODUCTIVITY_METRIC_PATHS = [
  "users",
  "monthly_arr",
  "valuation",
  "funding",
  "news_mentions",
  "github.stars",
  "pypi.downloads_last_month",
] as const;

const METRIC_GROUPS = new Set(["github", "pypi"]);
const SCOPES = new Set(["product", "parent"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);
const SOURCE_TYPES = new Set(["vendor", "third_party", "third_party_estimate"]);
const BUSINESS_KEYS = ["pricing_model", "base_price", "free_tier", "enterprise_pricing"] as const;

/** `data.metrics_provenance.<path>`: the existing `{ source, as_of }` shape plus scope and confidence. */
export type MetricProvenance = Record<string, string>;

export interface ProductivityMetric {
  /** Dotted path under `data.metrics`, e.g. `github.stars`. */
  path: string;
  value: number;
  provenance: MetricProvenance;
}

export type BusinessKey = (typeof BUSINESS_KEYS)[number];

export interface ProductivityInfo {
  description?: string;
  features?: string[];
  company?: string;
  /** Only the keys the file states; a null in the file means "not stated" and is not written. */
  business: Partial<Record<BusinessKey, string | number | boolean>>;
}

export interface ProductivityToolEntry {
  slug: string;
  includeIn0033: boolean;
  metrics: ProductivityMetric[];
  info: ProductivityInfo;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseMetric(where: string, path: string, leaf: unknown, errors: string[]): ProductivityMetric | null {
  if (!(PRODUCTIVITY_METRIC_PATHS as readonly string[]).includes(path)) {
    errors.push(`${where}: metric ${path} is not a key the ranking engine reads`);
    return null;
  }
  if (!isObject(leaf)) {
    errors.push(`${where}.${path}: must be an object with value and source_url`);
    return null;
  }
  const at = `${where}.${path}`;
  const before = errors.length;
  const value = leaf["value"];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) errors.push(`${at}.value: must be a positive number`);
  if (!isHttpUrl(leaf["source_url"])) errors.push(`${at}.source_url: must be an http(s) URL`);
  if (!isIsoDate(leaf["as_of"])) errors.push(`${at}.as_of: must be a YYYY-MM-DD date`);
  if (!SCOPES.has(leaf["scope"] as string)) errors.push(`${at}.scope: must be product or parent`);
  if (!SOURCE_TYPES.has(leaf["source_type"] as string)) errors.push(`${at}.source_type: must be vendor, third_party or third_party_estimate`);
  if (!CONFIDENCES.has(leaf["confidence"] as string)) errors.push(`${at}.confidence: must be high, medium or low`);
  if (leaf["currency"] !== undefined && !(typeof leaf["currency"] === "string" && /^[A-Z]{3}$/.test(leaf["currency"]))) {
    errors.push(`${at}.currency: must be a three-letter code`);
  }
  for (const key of ["unit", "attributed_to"] as const) {
    if (leaf[key] !== undefined && !isNonEmptyString(leaf[key])) errors.push(`${at}.${key}: must be a non-empty string`);
  }
  if (errors.length > before) return null;
  // #314: provenance keeps scope (D80.1) and the confidence mark; quote and note stay in the file.
  const provenance: MetricProvenance = {
    source: leaf["source_url"] as string,
    as_of: leaf["as_of"] as string,
    scope: leaf["scope"] as string,
    source_type: leaf["source_type"] as string,
    confidence: leaf["confidence"] as string,
  };
  for (const key of ["unit", "currency", "attributed_to"] as const) {
    if (typeof leaf[key] === "string") provenance[key] = leaf[key] as string;
  }
  return { path, value: value as number, provenance };
}

function parseMetrics(where: string, metrics: unknown, errors: string[]): ProductivityMetric[] {
  if (!isObject(metrics)) {
    errors.push(`${where}: metrics must be an object`);
    return [];
  }
  const out: ProductivityMetric[] = [];
  for (const [key, node] of Object.entries(metrics)) {
    if (METRIC_GROUPS.has(key)) {
      if (!isObject(node)) {
        errors.push(`${where}.${key}: must be an object`);
        continue;
      }
      for (const [sub, leaf] of Object.entries(node)) {
        const m = parseMetric(where, `${key}.${sub}`, leaf, errors);
        if (m) out.push(m);
      }
    } else {
      const m = parseMetric(where, key, node, errors);
      if (m) out.push(m);
    }
  }
  return out;
}

function parseBusiness(where: string, business: unknown, errors: string[]): ProductivityInfo["business"] {
  if (business === undefined) return {};
  if (!isObject(business)) {
    errors.push(`${where}: must be an object`);
    return {};
  }
  const out: ProductivityInfo["business"] = {};
  for (const [key, value] of Object.entries(business)) {
    if (!(BUSINESS_KEYS as readonly string[]).includes(key)) {
      errors.push(`${where}.${key}: not a business key the ranking engine reads`);
      continue;
    }
    if (value === null) continue;
    const ok =
      key === "pricing_model"
        ? isNonEmptyString(value)
        : key === "base_price"
          ? typeof value === "number" && Number.isFinite(value) && value >= 0
          : typeof value === "boolean";
    if (!ok) errors.push(`${where}.${key}: has the wrong type`);
    else out[key as BusinessKey] = value as string | number | boolean;
  }
  return out;
}

function parseInfo(where: string, info: unknown, errors: string[]): ProductivityInfo {
  if (!isObject(info)) {
    errors.push(`${where}: info must be an object`);
    return { business: {} };
  }
  const out: ProductivityInfo = { business: parseBusiness(`${where}.business`, info["business"], errors) };
  if (info["description"] !== undefined) {
    if (isNonEmptyString(info["description"])) out.description = info["description"];
    else errors.push(`${where}.description: must be a non-empty string`);
  }
  if (info["company"] !== undefined) {
    if (isNonEmptyString(info["company"])) out.company = info["company"];
    else errors.push(`${where}.company: must be a non-empty string`);
  }
  if (info["features"] !== undefined) {
    const f = info["features"];
    if (Array.isArray(f) && f.length > 0 && f.every(isNonEmptyString)) out.features = [...f];
    else errors.push(`${where}.features: must be a non-empty array of non-empty strings`);
  }
  return out;
}

/**
 * Why: the loader must fail closed; one bad field anywhere aborts the whole load.
 * What: parses `text`, validates every tool against the allowlist and the field rules above, and
 *   returns the entries in file order. Throws one Error naming every problem found.
 * Test: `tests/unit/productivity-metrics-loader-314.test.ts`
 */
export function parseProductivityMetrics(text: string): ProductivityToolEntry[] {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    throw new Error(`metrics file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isObject(doc) || !isObject(doc["tools"])) throw new Error("metrics file must be an object with a tools object");
  const errors: string[] = [];
  const entries: ProductivityToolEntry[] = [];
  const tools = Object.entries(doc["tools"]);
  if (tools.length === 0) errors.push("tools is empty");
  for (const [slug, tool] of tools) {
    const where = `tools.${slug}`;
    // #314: an allowlist, not a kind check alone: only the nine 0027 rows are ever written.
    if (!(PRODUCTIVITY_SLUGS as readonly string[]).includes(slug)) {
      errors.push(`${where}: slug is not one of the nine productivity slugs`);
      continue;
    }
    if (!isObject(tool)) {
      errors.push(`${where}: must be an object`);
      continue;
    }
    if (typeof tool["include_in_0033"] !== "boolean") errors.push(`${where}.include_in_0033: must be true or false`);
    entries.push({
      slug,
      includeIn0033: tool["include_in_0033"] === true,
      metrics: parseMetrics(`${where}.metrics`, tool["metrics"], errors),
      info: parseInfo(`${where}.info`, tool["info"], errors),
    });
  }
  if (errors.length > 0) throw new Error(`${errors.length} problem(s) in the metrics file:\n  ${errors.join("\n  ")}`);
  return entries;
}
