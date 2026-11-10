/**
 * The Codex merge: `openai-codex-cli` into `openai-codex` (Architect ticket ar-Te2/T76).
 *
 * Why: the board carries two rows for one product. `openai-codex` (data.id 40) is a 2025
 *   seed whose description calls it "the AI model powering GitHub Copilot"; the news mapper
 *   and the Terminal-Bench mapping send Codex's signals to `openai-codex-cli` (data.id 24).
 *   Neither row carries GitHub stars or npm downloads, so both lose adoption points and the
 *   data-completeness multiplier. The owner's rules: no manual rank override, no scoring or
 *   weight change, the ranking method stays as it is.
 * What: the Codex part of the D90 merge path (`--set codex`, scripts/merge-duplicate-tools.ts).
 *   `checkCodexRows` guards the two rows (slugs, data ids, statuses, kind) and names the
 *   state: `merge` (both active) or `already-merged` (the CLI row redirects to the survivor
 *   and the survivor carries the merge marker); anything else is refused. `planSurvivorData`
 *   is pure: it builds the survivor's new `data` field by field (rules in its doc comment)
 *   and returns one decision line per field. `countNewsMentions` counts the 12-month news
 *   corpus with the site's own tagging (`articleToolTags`), with the CLI row as a redirect,
 *   so an article tagged to either row counts once. `codexPatch` writes the planned data
 *   inside the D90 apply transaction and reads it back. Codex merge (D35): `planCurrentText`
 *   replaces the survivor's 2021 tagline, summary and pricing, in the merge and, on an
 *   already-merged pair, as a correction of its own.
 * Test: `tests/unit/codex-merge-t76.test.ts`.
 */

import { buildToolCatalogue, articleToolTags, type CatalogueTool } from "../lib/news-tool-resolver";
import { canonicalizeMetricPaths } from "../lib/ranking-algorithm-v76";
import { type BackupVerdict, MergeRefusedError } from "./duplicate-tool-merge-apply";
import { MERGE_SETS, type MergeState, type Queryable, type ToolRow } from "./duplicate-tool-merge";

export const CODEX_SURVIVOR = { slug: "openai-codex", dataId: "40" } as const;
export const CODEX_OLD = { slug: "openai-codex-cli", dataId: "24" } as const;
export const CODEX_KIND = "harness";
export const CODEX_RULING = MERGE_SETS.codex.ruling;

/**
 * Figures fetched for this change with the repo's collectors (`GitHubMetricsCollector.fetchMetrics`,
 * `NpmMetricsCollector.getDownloadStats`) at `fetched_at`. They are constants so the dry run and
 * the apply write the reviewed numbers, never a fresh fetch.
 */
export const CODEX_FETCHED = {
  fetched_at: "2026-11-10T00:48:54Z",
  github_stars: {
    value: 134417,
    source: "https://api.github.com/repos/openai/codex",
    as_of: "2026-11-10",
  },
  npm: {
    value: {
      package_name: "@openai/codex",
      downloads_last_month: 96036077,
      collected_at: "2026-11-10",
      window: "2026-10-10..2026-11-08",
    },
    source: "https://api.npmjs.org/downloads/point/2026-10-10:2026-11-08/@openai%2Fcodex",
    as_of: "2026-11-08",
  },
} as const;

export const NEWS_SOURCE = "https://aipowerranking.com/api/news";

/** What Codex is today (OpenAI's README for openai/codex and chatgpt.com/codex, read 2026-11-10). */
export const CODEX_DESCRIPTION =
  "Codex is OpenAI's coding agent. It runs in the terminal as the open-source Codex CLI, in code editors " +
  "such as VS Code, Cursor and Windsurf through the Codex IDE extension, and in the cloud from ChatGPT, " +
  "where it works on several tasks in parallel in isolated environments. It reads and edits code, runs " +
  "commands and tests, and reviews pull requests.";

/** The product page OpenAI's own README links; openai.com/codex answers 403 to a non-browser client. */
export const CODEX_WEBSITE = "https://chatgpt.com/codex";

// Codex merge (D35): the survivor's tagline, info.summary and pricing are the 2021 Codex API's.
/** The 2021 Codex model wording the survivor carries in `tagline` and `info.summary`. */
export const CODEX_2021_TEXT = "AI system that translates natural language to code";
/** The 2021 Codex API pricing the survivor carries in `pricing_model` and `info.business.pricing_model`. */
export const CODEX_2021_PRICING = "api-based";
/** Today's tagline, drawn from `CODEX_DESCRIPTION`. */
export const CODEX_TAGLINE = "OpenAI's coding agent for the terminal, code editors and the cloud";
/** Today's summary: `CODEX_TAGLINE`, the open-source CLI, and how Codex is bought. No prices. */
export const CODEX_SUMMARY =
  `${CODEX_TAGLINE}. The Codex CLI is open source; Codex is available with ChatGPT plans and through the OpenAI API.`;
/** The CLI row's `info.business.pricing_model`. */
export const CODEX_PRICING_MODEL = "open-source";

type Data = Record<string, unknown>;

const obj = (value: unknown): Data =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : {};

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "object" && Object.keys(value as Data).length === 0;
}

const show = (value: unknown): string => {
  const text = JSON.stringify(value) ?? "undefined";
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

const dataId = (row: ToolRow): string | null => (row.data?.["id"] === undefined ? null : String(row.data["id"]));
const mergedFrom = (row: ToolRow): unknown[] => (Array.isArray(row.data?.["merged_from"]) ? (row.data["merged_from"] as unknown[]) : []);

export type CodexCheck =
  | { ok: true; state: "merge" | "already-merged"; survivor: ToolRow; old: ToolRow }
  | { ok: false; problems: string[] };

/**
 * Guards the two rows before any plan or write.
 *
 * Postcondition: `ok` only when both rows exist with their data ids (40, 24), kind harness,
 *   no conflicting `data.slug`, the survivor active, and the pair either unmerged (CLI row
 *   active, no marker) or fully merged (CLI row redirecting to the survivor, marker set).
 */
export function checkCodexRows(rows: readonly ToolRow[]): CodexCheck {
  const problems: string[] = [];
  const survivor = rows.find((r) => r.slug === CODEX_SURVIVOR.slug);
  const old = rows.find((r) => r.slug === CODEX_OLD.slug);
  for (const [row, spec] of [
    [survivor, CODEX_SURVIVOR],
    [old, CODEX_OLD],
  ] as const) {
    if (!row) {
      problems.push(`row ${spec.slug} is missing`);
      continue;
    }
    if (dataId(row) !== spec.dataId) problems.push(`${spec.slug} has data.id ${dataId(row) ?? "(none)"}, expected ${spec.dataId}`);
    if (row.kind !== CODEX_KIND) problems.push(`${spec.slug} is kind ${row.kind}, expected ${CODEX_KIND}`);
    const slug = row.data?.["slug"];
    if (slug !== undefined && slug !== spec.slug) problems.push(`${spec.slug} carries data.slug ${show(slug)}`);
  }
  if (survivor && survivor.status !== "active") problems.push(`${CODEX_SURVIVOR.slug} is ${survivor.status}, expected active`);
  if (!survivor || !old || problems.length > 0) return { ok: false, problems };

  const marked = mergedFrom(survivor).includes(CODEX_OLD.slug);
  if (old.status === "active" && !marked) return { ok: true, state: "merge", survivor, old };
  if (old.status === "redirect" && old.data?.["redirect_to"] === CODEX_SURVIVOR.slug && marked) {
    return { ok: true, state: "already-merged", survivor, old };
  }
  return {
    ok: false,
    problems: [
      `unexpected state: ${CODEX_OLD.slug} is ${old.status} (redirect_to ${show(old.data?.["redirect_to"])}), ` +
        `${CODEX_SURVIVOR.slug} ${marked ? "carries" : "lacks"} the merge marker`,
    ],
  };
}

const PROVENANCE_PATHS: readonly (readonly string[])[] = [["business_metrics_provenance", "fields"], ["metrics_provenance"]];

function readPath(data: Data, path: readonly string[]): Data {
  return path.reduce<Data>((node, key) => obj(node[key]), data);
}

/** Writes `node[key] = value` under `path`, creating plain objects on the way. */
function writePath(data: Data, path: readonly string[], key: string, value: unknown): void {
  let node = data;
  for (const segment of path) {
    if (!node[segment] || typeof node[segment] !== "object" || Array.isArray(node[segment])) node[segment] = {};
    node = node[segment] as Data;
  }
  if (value === undefined) delete node[key];
  else node[key] = value;
}

/** The latest `as_of` either provenance block records for a metric key, or null. */
function provenanceAsOf(data: Data, key: string): string | null {
  const dates = PROVENANCE_PATHS.map((p) => obj(readPath(data, p)[key])["as_of"]).filter((d): d is string => typeof d === "string");
  return dates.sort().at(-1) ?? null;
}

/** The engine's view of a row's metrics: `data.metrics` wins per key over `data.info.metrics`. */
const canonicalMetrics = (data: Data): Data => canonicalizeMetricPaths(obj(data["metrics"]), obj(obj(data["info"])["metrics"]));

/** Set from the fetched figures or the news count; the rows' own values never win. */
const FRESH_METRICS = ["github_stars", "npm", "news_mentions"] as const;

/** Top-level keys that name or describe the survivor itself, or that this merge writes. */
const OWN_TOP_KEYS = new Set([
  "id", "slug", "name", "status", "category", "kind", "logo_url", "created_at", "updated_at",
  "info", "metrics", "business_metrics_provenance", "metrics_provenance", "description", "website_url",
  "redirect_to", "redirect_reason", "previous_status", "merged_from", "merge_reason",
  // Codex merge (D35): written by `planCurrentText`, not by the fill.
  "tagline", "pricing_model",
]);
// Codex merge (D35): `summary` and `business` are written by `planCurrentText`, not by the fill.
const OWN_INFO_KEYS = new Set(["metrics", "description", "website", "technical", "summary", "business"]);

export interface TextPlan {
  data: Data;
  decisions: string[];
  /** The fields set, e.g. `tagline`, `info.business.pricing_model`; empty when nothing changes. */
  changed: string[];
}

/**
 * Codex merge (D35): replaces the 2021 Codex API text the survivor keeps.
 *
 * Why: the survivor's `tagline` and `info.summary` say "AI system that translates natural
 *   language to code" and its pricing is "api-based": the 2021 model, not today's coding agent.
 * What: pure. `tagline` and `info.summary` set to `CODEX_TAGLINE` and `CODEX_SUMMARY`, and
 *   `pricing_model` and `info.business.pricing_model` to `CODEX_PRICING_MODEL`, each only when
 *   the stored value is the 2021 wording or empty; any other value is kept. Other
 *   `info.business` keys stay; an empty `info.business` starts from the CLI's (`cli`). Used by
 *   the merge (`planSurvivorData`) and, on an already-merged pair, by the dry run and apply,
 *   so a row merged before this rule existed is corrected; a corrected row plans no change.
 * Test: `tests/unit/codex-merge-t76.test.ts` ("planCurrentText").
 */
export function planCurrentText(survivorData: Data, cli: Data = {}): TextPlan {
  const data = structuredClone(survivorData);
  const decisions: string[] = [];
  const changed: string[] = [];
  const info = (data["info"] = structuredClone(obj(data["info"]))) as Data;
  const cliBusiness = obj(obj(cli["info"])["business"]);
  const business = (info["business"] = structuredClone(isEmpty(info["business"]) ? cliBusiness : obj(info["business"]))) as Data;
  if (isEmpty(obj(survivorData["info"])["business"]) && !isEmpty(cliBusiness)) {
    changed.push("info.business");
    decisions.push(`  field info.business: cli ${show(cliBusiness)} (survivor empty)`);
  }
  const fields: Array<[string, Data, string, string, string]> = [
    ["tagline", data, "tagline", CODEX_2021_TEXT, CODEX_TAGLINE],
    ["info.summary", info, "summary", CODEX_2021_TEXT, CODEX_SUMMARY],
    ["pricing_model", data, "pricing_model", CODEX_2021_PRICING, CODEX_PRICING_MODEL],
    ["info.business.pricing_model", business, "pricing_model", CODEX_2021_PRICING, CODEX_PRICING_MODEL],
  ];
  for (const [field, node, key, stale, current] of fields) {
    const was = node[key];
    if (was === current) {
      decisions.push(`  field ${field}: already current ${show(was)}`);
    } else if (isEmpty(was) || was === stale) {
      node[key] = current;
      changed.push(field);
      decisions.push(`  field ${field}: set to ${show(current)} (was ${isEmpty(was) ? "empty" : `the 2021 wording ${show(was)}`})`);
    } else {
      decisions.push(`  field ${field}: survivor kept ${show(was)} (not the 2021 wording)`);
    }
  }
  return { data, decisions, changed };
}

export interface SurvivorPlan {
  data: Data;
  decisions: string[];
}

export interface SurvivorInputs {
  /** The 12-month news count for the survivor with the CLI row merged (`countNewsMentions`). */
  newsMentions: number;
  /** The apply date, `YYYY-MM-DD`, for the news count's provenance. */
  asOf: string;
}

/**
 * The survivor's `data` after the merge. Pure; neither input is mutated.
 *
 * Rules, per field:
 * - Identity (id, slug, name, category, logo, kind, status) stays the survivor's.
 * - `description` and `info.description`: `CODEX_DESCRIPTION`; `website_url`, `info.website`
 *   (and `info.links.website` when present): `CODEX_WEBSITE`. The stored text is wrong.
 * - `metrics.github_stars` and `metrics.npm`: the fetched figures with provenance in the
 *   0024 shape (`business_metrics_provenance.fields.<key>`); a stored `github.stars` (either
 *   metrics path), which the engine reads first, gets the same figure at
 *   `metrics.github`. `metrics.news_mentions`: the merged count.
 * - Every other metric key: the row holding it; when both do, the CLI value wins only when its
 *   provenance `as_of` is newer (a sourced value beats an unsourced one) or neither is sourced,
 *   else the survivor's stays. A value moves with its provenance entries.
 * - `info.technical`: the CLI's value per key (the survivor's block describes the 2021 Codex
 *   model), except `language_support`, the union of both lists.
 * - `tagline`, `info.summary`, `pricing_model`, `info.business`: `planCurrentText` (Codex merge, D35).
 * - Every other top-level and `info` field: the survivor's, or the CLI's when the survivor's is empty.
 */
export function planSurvivorData(survivor: ToolRow, old: ToolRow, inputs: SurvivorInputs): SurvivorPlan {
  const data = structuredClone(survivor.data ?? {}) as Data;
  const from = (old.data ?? {}) as Data;
  const decisions: string[] = [];
  const say = (field: string, text: string) => decisions.push(`  field ${field}: ${text}`);

  // Identity and descriptive text.
  say("id, slug, name, category, kind, logo_url", `survivor kept (${CODEX_SURVIVOR.slug}, data.id ${CODEX_SURVIVOR.dataId})`);
  data["description"] = CODEX_DESCRIPTION;
  say("description", `set to the current product description (was ${show(survivor.data?.["description"])})`);
  data["website_url"] = CODEX_WEBSITE;
  say("website_url", `set to ${CODEX_WEBSITE} (survivor ${show(survivor.data?.["website_url"])}, cli ${show(from["website_url"])})`);
  const info = (data["info"] = structuredClone(obj(data["info"]))) as Data;
  const oldInfo = obj(from["info"]);
  info["description"] = CODEX_DESCRIPTION;
  info["website"] = CODEX_WEBSITE;
  say("info.description, info.website", "set to the same description and website");
  if (typeof obj(info["links"])["website"] === "string") {
    writePath(info, ["links"], "website", CODEX_WEBSITE);
    say("info.links.website", `set to ${CODEX_WEBSITE}`);
  }

  // Metrics: the merge rule per key, then the fresh figures.
  const mine = canonicalMetrics(survivor.data ?? {});
  const theirs = canonicalMetrics(from);
  const keys = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].filter((k) => !(FRESH_METRICS as readonly string[]).includes(k)).sort();
  for (const key of keys) {
    const has = { mine: !isEmpty(mine[key]), theirs: !isEmpty(theirs[key]) };
    if (!has.theirs) {
      say(`metrics.${key}`, `survivor kept ${show(mine[key])} (cli holds none)`);
      continue;
    }
    const asOf = { mine: provenanceAsOf(survivor.data ?? {}, key), theirs: provenanceAsOf(from, key) };
    // Both unsourced: the CLI's value, as the survivor's describes the 2021 model.
    const takeTheirs = !has.mine || (asOf.theirs === null ? asOf.mine === null : asOf.mine === null || asOf.theirs > asOf.mine);
    const why = `survivor ${show(mine[key])} as_of ${asOf.mine ?? "none"}, cli ${show(theirs[key])} as_of ${asOf.theirs ?? "none"}`;
    if (!takeTheirs) {
      say(`metrics.${key}`, `survivor kept (${why})`);
      continue;
    }
    writePath(data, ["metrics"], key, structuredClone(theirs[key]));
    for (const p of PROVENANCE_PATHS) writePath(data, p, key, structuredClone(readPath(from, p)[key]));
    say(`metrics.${key}`, `cli value taken with its provenance (${why})`);
  }
  const entry = (value: unknown, source: string, asOfDay: string, extra: Data = {}) => ({
    value,
    source,
    migration: "codex-merge",
    issue: CODEX_RULING,
    as_of: asOfDay,
    ...extra,
  });
  const fresh: Array<[string, unknown, Data]> = [
    ["github_stars", CODEX_FETCHED.github_stars.value, entry(CODEX_FETCHED.github_stars.value, CODEX_FETCHED.github_stars.source, CODEX_FETCHED.github_stars.as_of, { fetched_at: CODEX_FETCHED.fetched_at })],
    ["npm", { ...CODEX_FETCHED.npm.value }, entry({ ...CODEX_FETCHED.npm.value }, CODEX_FETCHED.npm.source, CODEX_FETCHED.npm.as_of, { fetched_at: CODEX_FETCHED.fetched_at })],
    ["news_mentions", inputs.newsMentions, entry(inputs.newsMentions, NEWS_SOURCE, inputs.asOf, { window: "12 months" })],
  ];
  for (const [key, value, provenance] of fresh) {
    writePath(data, ["metrics"], key, value);
    writePath(data, ["metrics_provenance"], key, undefined);
    writePath(data, ["business_metrics_provenance", "fields"], key, provenance);
    say(`metrics.${key}`, `set to ${show(value)} from ${String(provenance["source"])} (survivor had ${show(mine[key])}, cli ${show(theirs[key])})`);
  }
  // Read through the canonical paths, so a github block stored only under info.metrics is found;
  // the whole block is written top level, where the engine's shallow merge reads it first.
  const github = obj(canonicalMetrics(data)["github"]);
  if (typeof github["stars"] === "number") {
    writePath(data, ["metrics"], "github", { ...structuredClone(github), stars: CODEX_FETCHED.github_stars.value });
    say("metrics.github.stars", `set to ${CODEX_FETCHED.github_stars.value}; the engine reads it before github_stars (was ${github["stars"]})`);
  }

  // info.technical: the CLI's current-agent facts, languages unioned.
  const tech = obj(info["technical"]);
  const oldTech = obj(oldInfo["technical"]);
  const techOut: Data = { ...structuredClone(tech) };
  for (const key of [...new Set([...Object.keys(tech), ...Object.keys(oldTech)])].sort()) {
    if (key === "language_support" && Array.isArray(tech[key]) && Array.isArray(oldTech[key])) {
      techOut[key] = [...new Set([...(tech[key] as unknown[]), ...(oldTech[key] as unknown[])])];
      say(`info.technical.${key}`, `union of both rows (${(techOut[key] as unknown[]).length} entries)`);
    } else if (!isEmpty(oldTech[key]) || typeof oldTech[key] === "boolean") {
      techOut[key] = structuredClone(oldTech[key]);
      say(`info.technical.${key}`, `cli ${show(oldTech[key])} (survivor ${show(tech[key])} describes the 2021 model)`);
    }
  }
  if (Object.keys(techOut).length > 0) info["technical"] = techOut;

  // Everything else: the survivor's value, or the CLI's where the survivor's is empty.
  const fill = (target: Data, source: Data, own: Set<string>, prefix: string) => {
    for (const key of [...new Set([...Object.keys(target), ...Object.keys(source)])].sort()) {
      if (own.has(key) || isEmpty(source[key])) continue;
      if (isEmpty(target[key])) {
        target[key] = structuredClone(source[key]);
        say(`${prefix}${key}`, `cli ${show(source[key])} (survivor empty)`);
      } else say(`${prefix}${key}`, `survivor kept ${show(target[key])} (cli ${show(source[key])})`);
    }
  };
  fill(info, oldInfo, OWN_INFO_KEYS, "info.");
  fill(data, from, OWN_TOP_KEYS, "");

  // Codex merge (D35): the 2021 tagline, summary and pricing give way to today's product.
  const text = planCurrentText(data, from);
  Object.assign(data, text.data);
  decisions.push(...text.decisions);

  data["merged_from"] = [...mergedFrom(survivor), CODEX_OLD.slug];
  data["merge_reason"] = `${CODEX_RULING}: ${CODEX_OLD.slug} merged into ${CODEX_SURVIVOR.slug}`;
  say("merged_from", `adds ${CODEX_OLD.slug} (the re-run marker)`);
  return { data, decisions };
}

export interface NewsInputs {
  catalogue: CatalogueTool[];
  articles: Array<{ title: unknown; toolMentions: unknown }>;
}

// The `ToolsRepository.findNewsCatalogueRows` view: JSONB id, slug and name over the columns.
const CATALOGUE_SQL = `SELECT id::text AS db_id,
  CASE WHEN data ? 'id' THEN (CASE WHEN jsonb_typeof(data->'id') = 'string' THEN data->>'id' END) ELSE id::text END AS id,
  COALESCE(data->>'slug', slug) AS slug, COALESCE(data->>'name', name) AS name, kind, status,
  data->'redirect_to' AS redirect_to
  FROM public."tools" ORDER BY slug`;
// The 0024 window: active articles of the last 12 months, by published date else creation.
const ARTICLES_SQL = `SELECT title, tool_mentions FROM public."articles"
  WHERE status = 'active'
    AND COALESCE(published_date, created_at) >= $1::timestamptz - interval '12 months'
    AND COALESCE(published_date, created_at) <= $1::timestamptz
  ORDER BY id`;

/** SELECT-only reads for `countNewsMentions`. */
export async function loadNewsInputs(q: Queryable, now: Date): Promise<NewsInputs> {
  const catalogue = (await q.query(CATALOGUE_SQL)).rows as CatalogueTool[];
  const rows = (await q.query(ARTICLES_SQL, [now.toISOString()])).rows as Array<{ title: unknown; tool_mentions: unknown }>;
  return { catalogue, articles: rows.map((r) => ({ title: r.title, toolMentions: r.tool_mentions })) };
}

/**
 * News counts with the site's tagging: before (each row as stored) and after (the CLI row
 * redirecting to the survivor). After is at least the larger before count and at most their sum.
 */
export function countNewsMentions(inputs: NewsInputs): { survivor: number; old: number; merged: number } {
  const count = (catalogue: CatalogueTool[], slug: string) => {
    const built = buildToolCatalogue(catalogue);
    return inputs.articles.filter((a) => articleToolTags(a, built).some((t) => t.slug === slug)).length;
  };
  const merged = inputs.catalogue.map((t) =>
    t.slug === CODEX_OLD.slug ? { ...t, status: "redirect", redirect_to: CODEX_SURVIVOR.slug } : t
  );
  return {
    survivor: count(inputs.catalogue, CODEX_SURVIVOR.slug),
    old: count(inputs.catalogue, CODEX_OLD.slug),
    merged: count(merged, CODEX_SURVIVOR.slug),
  };
}

const day = (now: Date) => now.toISOString().slice(0, 10);

/**
 * The Codex part of the dry run: guard, news counts and the field decisions. SELECT only.
 * Returns the survivor's planned data for the board report, or null when the guard refuses
 * or the pair is already merged.
 */
export async function codexDryRun(
  q: Queryable,
  state: MergeState,
  log: (line: string) => void,
  now: Date
): Promise<{ ok: boolean; survivorData: Data | null }> {
  const check = checkCodexRows(state.tools);
  if (!check.ok) {
    for (const problem of check.problems) log(`codex: UNRESOLVED: ${problem}`);
    return { ok: false, survivorData: null };
  }
  log(`codex: guards passed; state ${check.state}`);
  if (check.state === "already-merged") {
    // Codex merge (D35): a row merged before `planCurrentText` existed still has the 2021 text.
    const text = planCurrentText(check.survivor.data ?? {}, check.old.data ?? {});
    log(`codex: ${CODEX_SURVIVOR.slug} text check: ${text.changed.length > 0 ? `would set ${text.changed.join(", ")}` : "nothing to change"}`);
    for (const line of text.decisions) log(line);
    return { ok: true, survivorData: text.changed.length > 0 ? text.data : null };
  }
  const news = countNewsMentions(await loadNewsInputs(q, now));
  log(`codex: news mentions (12 months): ${CODEX_SURVIVOR.slug} ${news.survivor}, ${CODEX_OLD.slug} ${news.old}, merged ${news.merged}`);
  const plan = planSurvivorData(check.survivor, check.old, { newsMentions: news.merged, asOf: day(now) });
  log(`codex: ${CODEX_SURVIVOR.slug} would get, field by field:`);
  for (const line of plan.decisions) log(line);
  return { ok: true, survivorData: plan.data };
}

/** The Codex apply also changes the survivor row, so its backup must hold that row. */
export function codexBackupVerdict(raw: string): BackupVerdict {
  try {
    const tools = (JSON.parse(raw) as { tools?: unknown }).tools;
    const held = Array.isArray(tools) && tools.some((t) => obj(t)["slug"] === CODEX_SURVIVOR.slug);
    return held ? { ok: true } : { ok: false, reason: `the backup lacks the ${CODEX_SURVIVOR.slug} row` };
  } catch {
    return { ok: false, reason: "the backup file is not JSON" };
  }
}

const ROWS_SQL = `SELECT id::text AS id, slug, status, kind, data FROM public."tools"
  WHERE slug = ANY($1::text[]) ORDER BY slug FOR UPDATE`;

/**
 * The apply's survivor write, run by `applyMerge` inside its transaction. Re-checks the
 * guards on locked rows, writes the planned data, and reads it back. On an already-merged
 * pair it writes only `planCurrentText`'s correction (Codex merge, D35), and nothing when
 * that plans no change; throws `MergeRefusedError` on any unexpected state.
 */
export function codexPatch(now: Date, log: (line: string) => void = () => {}): (tx: Queryable) => Promise<void> {
  return async (tx) => {
    const rows = (await tx.query(ROWS_SQL, [[CODEX_SURVIVOR.slug, CODEX_OLD.slug]])).rows as ToolRow[];
    const check = checkCodexRows(rows);
    if (!check.ok) throw new MergeRefusedError(`codex guard: ${check.problems.join("; ")}`);
    let data: Data;
    if (check.state === "already-merged") {
      // Codex merge (D35): correct the 2021 text on a row merged before this rule existed.
      const correction = planCurrentText(check.survivor.data ?? {}, check.old.data ?? {});
      if (correction.changed.length === 0) return;
      data = correction.data;
      log(`codex: ${CODEX_SURVIVOR.slug} text corrected: ${correction.changed.join(", ")}`);
    } else {
      const news = countNewsMentions(await loadNewsInputs(tx, now));
      data = planSurvivorData(check.survivor, check.old, { newsMentions: news.merged, asOf: day(now) }).data;
    }
    const text = JSON.stringify(data);
    await tx.query(`UPDATE public."tools" SET data = $2::jsonb, updated_at = now() WHERE id = $1::uuid AND status = 'active'`, [
      check.survivor.id,
      text,
    ]);
    const back = (await tx.query(`SELECT data = $2::jsonb AS same FROM public."tools" WHERE id = $1::uuid`, [check.survivor.id, text]))
      .rows as Array<{ same: boolean }>;
    if (back[0]?.same !== true) throw new Error(`merge verification failed: ${CODEX_SURVIVOR.slug} data was not written`);
  };
}
