/**
 * Weekly digest generate-and-store (#181).
 *
 * Why: #181 asks for a weekly "what mattered" digest for developers choosing AI
 * coding tools. It is a paid LLM call whose output is published to the site and
 * RSS, so it must run once per closed ISO week, skip a week with nothing to say,
 * never overwrite a stored week by accident, and never store a body that breaks
 * the digest rules.
 * What: `generateWeeklyDigest` resolves the previous full ISO week, then: a stored
 * week is skipped unless `force`; 0 articles is skipped with no LLM call; `dryRun`
 * reports counts and stops. Otherwise it makes one OpenRouter call, validates the
 * body with `validateDigest`, and on a failed check makes exactly one more call
 * that names the failed checks. A second failure throws `WeeklyDigestError`. A
 * transport error, an empty-key error or a reply cut off at the token limit
 * throws at once. The row is written only after a valid body, so every failure
 * leaves any stored row as it was.
 * Test: `tests/unit/weekly-digest-service-181.test.ts`.
 */

import { CHANGELOG_ENTRIES } from "@/lib/data/changelog-entries";
import type { ChangelogEntry } from "@/lib/data/changelog-generator";
import { loggers } from "@/lib/logger";
import { readCompletion } from "@/lib/services/llm-completion";
import { getOpenRouterModel } from "@/lib/services/openrouter-model";
import { OPENROUTER_USAGE_REQUEST, recordOpenRouterUsage } from "@/lib/services/provider-usage";
import {
  type DigestInputs,
  assembleDigest,
  buildDigestPrompt,
  calculateDigestHash,
  digestTier,
  siteChangesForWindow,
  toolNamesOf,
} from "@/lib/services/weekly-digest-input";
import {
  type WeeklyDigestRepository,
  createWeeklyDigestRepository,
} from "@/lib/services/weekly-digest.repository";
import { getOpenRouterApiKey } from "@/lib/startup-validation";
import { countDigestWords, validateDigest } from "@/lib/weekly-digest-validate";
import { previousIsoWeek } from "@/lib/weekly-digest-window";

/** Completion budget: a 350-word digest is about 500 tokens; the rest is headroom. */
const DIGEST_MAX_TOKENS = 1500;

export type WeeklyDigestOutcome =
  | {
      status: "generated";
      week: string;
      tier: "short" | "full";
      wordCount: number;
      attempts: number;
      generationTimeMs: number;
    }
  | { status: "skipped"; week: string; reason: "already-stored" | "no-articles" }
  | {
      status: "dry-run";
      week: string;
      tier: "short" | "full";
      articleCount: number;
      newToolCount: number;
      siteChangeCount: number;
      promptChars: number;
    };

/** The validator rejected the digest on the retry as well; `failures` names each check. */
export class WeeklyDigestError extends Error {
  readonly failures: readonly string[];

  constructor(week: string, failures: readonly string[]) {
    super(`digest_rejected (${week}): ${failures.join("; ")}`);
    this.name = "WeeklyDigestError";
    this.failures = failures;
  }
}

export interface WeeklyDigestOptions {
  now?: Date;
  /** Replace a stored week. Without it a stored week is never touched. */
  force?: boolean;
  /** Aggregate and build the prompt, then stop: no LLM call, no write. */
  dryRun?: boolean;
}

/** Test seams: the database port and the changelog the site changes are read from. */
export interface WeeklyDigestDeps {
  repository?: WeeklyDigestRepository;
  changelog?: readonly ChangelogEntry[];
}

interface Draft {
  body: string;
  failures: string[];
  attempts: number;
  promptTokens: number;
  completionTokens: number;
}

async function callModel(
  apiKey: string,
  model: string,
  prompt: { system: string; user: string }
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Referer: process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3007",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.3,
      max_tokens: DIGEST_MAX_TOKENS,
      ...OPENROUTER_USAGE_REQUEST,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    loggers.api.error("OpenRouter API error (weekly digest)", { status: response.status });
    throw new Error(`OpenRouter API error (${response.status}): ${errorText.substring(0, 200)}`);
  }
  const data = await response.json();
  // #325: one ledger row per billed completion, written before the content checks. Never throws.
  await recordOpenRouterUsage({ operation: "weekly_digest", model, body: data });
  // #172: a digest cut off at max_tokens throws here and is never stored.
  const { content, diagnostics } = readCompletion(data, {
    label: "WeeklyDigest",
    model,
    maxTokens: DIGEST_MAX_TOKENS,
  });
  return {
    content,
    promptTokens: diagnostics.promptTokens ?? 0,
    completionTokens: diagnostics.completionTokens ?? 0,
  };
}

/** One call, and one more when the validator rejects the first body. */
async function draftWithOneRetry(inputs: DigestInputs): Promise<Draft> {
  const apiKey = getOpenRouterApiKey();
  const model = getOpenRouterModel();
  const context = {
    tier: inputs.tier,
    allowedSlugs: new Set(inputs.articles.map((a) => a.slug)),
    hasNewAndChanged: inputs.newTools.length + inputs.siteChanges.length > 0,
  };
  let failures: string[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let body = "";

  // #181: exactly two attempts. The second names the first one's failed checks.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const reply = await callModel(apiKey, model, buildDigestPrompt(inputs, failures));
    promptTokens += reply.promptTokens;
    completionTokens += reply.completionTokens;
    body = reply.content.trim();
    failures = validateDigest(body, context);
    if (failures.length === 0) return { body, failures, attempts: attempt, promptTokens, completionTokens };
    loggers.api.warn("Weekly digest draft rejected", { week: inputs.window.week, attempt, failures });
  }
  throw new WeeklyDigestError(inputs.window.week, failures);
}

/** The digest for the week before `options.now`, generated and stored once. */
export async function generateWeeklyDigest(
  options: WeeklyDigestOptions = {},
  deps: WeeklyDigestDeps = {}
): Promise<WeeklyDigestOutcome> {
  const startedAt = Date.now();
  const repository = deps.repository ?? createWeeklyDigestRepository();
  const window = previousIsoWeek(options.now ?? new Date());
  const { week } = window;

  // #181: a closed week is never rewritten unless the caller forces it, so
  // readers and RSS do not see a digest change. Checked before any other read.
  if (!options.force && (await repository.getByWeek(week))) {
    return { status: "skipped", week, reason: "already-stored" };
  }

  const articles = await repository.loadArticles(window);
  const tier = digestTier(articles.length);
  if (!tier) return { status: "skipped", week, reason: "no-articles" };

  const newTools = await repository.loadNewTools(window);
  const siteChanges = siteChangesForWindow(window, deps.changelog ?? CHANGELOG_ENTRIES);
  const inputs: DigestInputs = { window, tier, articles, newTools, siteChanges };

  if (options.dryRun) {
    const prompt = buildDigestPrompt(inputs);
    return {
      status: "dry-run",
      week,
      tier,
      articleCount: articles.length,
      newToolCount: newTools.length,
      siteChangeCount: siteChanges.length,
      promptChars: prompt.system.length + prompt.user.length,
    };
  }

  const draft = await draftWithOneRetry(inputs);
  const generationTimeMs = Date.now() - startedAt;
  const wordCount = countDigestWords(draft.body);

  const written = await repository.save(
    {
      week,
      windowStart: window.start,
      windowEnd: window.end,
      content: assembleDigest(window, draft.body, articles),
      dataHash: calculateDigestHash({
        week,
        articleIds: articles.map((a) => a.id),
        toolIds: newTools.map((t) => t.id),
        changeIds: siteChanges.map((c) => c.id),
      }),
      // #181: ids and names are kept so the monthly digest (#182) can build on them.
      metadata: {
        tier,
        model: getOpenRouterModel(),
        article_count: articles.length,
        new_tool_count: newTools.length,
        site_change_count: siteChanges.length,
        article_ids: articles.map((a) => a.id),
        tool_names: [...new Set(articles.flatMap(toolNamesOf))].sort(),
        new_tool_names: newTools.map((t) => t.name),
        word_count: wordCount,
        attempts: draft.attempts,
        prompt_tokens: draft.promptTokens,
        completion_tokens: draft.completionTokens,
        generation_time_ms: generationTimeMs,
        forced: Boolean(options.force),
      },
      generatedAt: new Date(),
    },
    Boolean(options.force)
  );
  // #181: false means another run stored this week between the first check and now.
  if (!written) return { status: "skipped", week, reason: "already-stored" };

  loggers.api.info("Weekly digest stored", { week, tier, wordCount, attempts: draft.attempts });
  return { status: "generated", week, tier, wordCount, attempts: draft.attempts, generationTimeMs };
}
