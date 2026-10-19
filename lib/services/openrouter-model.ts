/**
 * The one OpenRouter model id every live LLM call uses.
 *
 * Why: #172 — OpenRouter retired `anthropic/claude-sonnet-4` ("No endpoints found"),
 *   and because six call sites each hardcoded it, the daily-news cron failed with 500
 *   and ingestion stopped. One name and one default here mean the next retirement is a
 *   one-line change or an env override, not a hunt across the tree.
 * What: `getOpenRouterModel()` returns `OPENROUTER_MODEL` when it is set to a non-blank
 *   value, else `DEFAULT_OPENROUTER_MODEL`. It reads the environment at call time, so a
 *   changed env value takes effect without a module reload.
 * Test: `tests/unit/openrouter-model.test.ts`.
 */

/** Environment variable that overrides the model id. */
export const OPENROUTER_MODEL_ENV = "OPENROUTER_MODEL";

// #172: newest generally-available Anthropic Sonnet id on OpenRouter /api/v1/models
// (2026-10-19), replacing the retired `anthropic/claude-sonnet-4`.
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-5.5";

/** Resolves the model id for an OpenRouter call: env override, else the default. */
export function getOpenRouterModel(
  env: Record<string, string | undefined> = process.env
): string {
  const override = env[OPENROUTER_MODEL_ENV]?.trim();
  return override ? override : DEFAULT_OPENROUTER_MODEL;
}
