/**
 * Provider billing / credit error classification for the ingestion pipeline (#167).
 *
 * Why: On 2026-10-12 Tavily and Jina answered HTTP 402 and OpenRouter answered
 * "requires more credits, or fewer max_tokens". Every one of those errors was caught
 * per candidate, the candidates were counted as `quality_rejected`, and the run ended
 * `completed` with a 200 from the cron route. A billing failure is not a quiet day: no
 * candidate can succeed until an operator tops the account up, so the run must fail.
 *
 * The patterns here mirror PROVIDER_BILLING_ERROR_PATTERN and
 * OPENROUTER_CREDIT_ERROR_PATTERN in scripts/check-ingestion-gap.mjs, which reads the
 * same texts back out of `error_log`. Change both together.
 */

// OpenRouter's credit-exhaustion wordings: the 2026-07-25 "insufficient credits" text
// and the 2026-10-12 "requires more credits, or fewer max_tokens ... can only afford N".
const CREDITS_PATTERN = /insufficient credits?|requires more credits|can only afford/i;

// HTTP 402 as the provider clients format it ("API error: 402", "API error (402)",
// "status 402"), plus the payment wordings that travel with it. A bare `402` is NOT
// matched: it also occurs in URLs and ids, e.g. "Failed to ingest https://x/402: ...".
const PAYMENT_REQUIRED_PATTERN =
  /(?:error|status|code)\W{0,3}402\b|\b402\b\W{0,3}(?:payment required|insufficient)|payment required|insufficient ?balance|unpaid .{0,40}balance/i;

/** Longest provider message excerpt carried into a billing reason. */
const REASON_EXCERPT_CHARS = 200;

/**
 * Why: #167 — the pipeline must tell a billing failure (fail the run) from a rate limit,
 * an outage, or a source refusal (carry on with the next candidate or provider).
 * What: Returns the billing condition a provider error message describes —
 * "insufficient credits" or "HTTP 402 Payment Required" — or null when it describes
 * anything else. A 429 rate limit is never billing.
 * Test: `providerBillingCondition` cases in lib/services/provider-billing-errors.test.ts.
 */
export function providerBillingCondition(message: string): string | null {
  if (CREDITS_PATTERN.test(message)) return "insufficient credits";
  if (PAYMENT_REQUIRED_PATTERN.test(message)) return "HTTP 402 Payment Required";
  return null;
}

/**
 * Why: #167 — one ingestion run can hit the same billing error once per candidate; the
 * run's error_log needs one line per provider that is out of credit, not twenty copies.
 * What: Collects at most one reason per provider. `note()` ignores any message that
 * providerBillingCondition() does not classify as billing. Each reason names the
 * provider and the condition, then quotes the provider's own text.
 * Test: `ProviderBillingFailures` case in lib/services/provider-billing-errors.test.ts;
 * end to end in tests/unit/cron-daily-news-billing.test.ts.
 */
export class ProviderBillingFailures {
  private readonly byProvider = new Map<string, string>();

  note(provider: string, message: string): void {
    if (this.byProvider.has(provider)) return;
    const condition = providerBillingCondition(message);
    if (!condition) return;
    this.byProvider.set(
      provider,
      `Provider billing error [${provider}]: ${condition} — ${message.substring(0, REASON_EXCERPT_CHARS)}`
    );
  }

  reasons(): string[] {
    return [...this.byProvider.values()];
  }
}
