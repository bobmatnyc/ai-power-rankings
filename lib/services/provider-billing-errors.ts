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

// #167: HTTP 402 only in the forms a provider's own API error takes — Tavily
// ("Tavily API error: 402", "Tavily Extract API error: 402") and Jina ("Jina.ai API
// error (402)", "402 InsufficientBalanceError"). A target site's own "402 Payment
// Required" or "insufficient balance" (paywall) is not billing. Every alternative needs
// whitespace, which a URL cannot hold, so "https://x/error/402" cannot match.
const PAYMENT_REQUIRED_PATTERN =
  /\bTavily (?:Extract )?API error:\s*402\b|\bJina\.ai API error \(402\)|\b402\s+InsufficientBalanceError\b/i;

// #167: Tavily Extract's per-URL failure ("Extraction failed: <site error>") arrives in
// an HTTP 200 response, so Tavily's account is in good standing; the text is the site's.
const PER_URL_EXTRACTION_FAILURE = /^Extraction failed:/;

/** Longest provider message excerpt carried into a billing reason. */
const REASON_EXCERPT_CHARS = 200;

/**
 * Why: #167 — the pipeline must tell a billing failure (fail the run) from a rate limit,
 * an outage, or a source refusal (carry on with the next candidate or provider).
 * What: Returns the billing condition a provider error message describes —
 * "insufficient credits" or "HTTP 402 Payment Required" — or null when it describes
 * anything else. A 429 rate limit is never billing, nor is a target site's own
 * 402 / balance text relayed in an extraction failure, nor a URL.
 * Test: `providerBillingCondition` cases in lib/services/provider-billing-errors.test.ts.
 */
export function providerBillingCondition(message: string): string | null {
  if (PER_URL_EXTRACTION_FAILURE.test(message)) return null; // #167: site text, not the provider's
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
