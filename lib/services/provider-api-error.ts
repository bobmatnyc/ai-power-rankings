/**
 * Typed error for an HTTP error answered by a paid provider's own API (#367).
 *
 * Why: On 2026-11-01 every Tavily call answered 401 (invalid key). The ingestion
 * pipeline read "401" out of the error text, took it as the news site refusing the
 * page, and permanently blocked techcrunch.com, wired.com and arstechnica.com. The
 * text cannot say which call failed; the call site can. A provider client throws this
 * error when the provider's own endpoint answers non-2xx, so callers decide from the
 * error's type and status, never from substrings in its message.
 */

/**
 * Why: #367 — carries which provider answered and its HTTP status, so a provider
 * failure is never mistaken for a news-site refusal.
 * What: An Error whose `provider` names the API that answered (tavily, jina,
 * openrouter) and whose `status` is that API's HTTP status. `status` is undefined
 * only for a wrapper that relays an inner error (see OpenRouterError).
 * Test: `providerApiStatusOf` cases in lib/services/provider-api-error.test.ts.
 */
export class ProviderApiError extends Error {
  readonly provider: string;
  readonly status: number | undefined;

  constructor(provider: string, status: number | undefined, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderApiError";
    this.provider = provider;
    this.status = status;
  }
}

/** Longest error chain walked; a chain is short, this only stops a cycle. */
const MAX_CHAIN_DEPTH = 5;

/** The next error in a wrapping chain: standard `cause`, or OpenRouterError's `originalError`. */
function innerError(error: unknown): unknown {
  if (!error || typeof error !== "object") return undefined;
  const { cause, originalError } = error as { cause?: unknown; originalError?: unknown };
  return cause ?? originalError;
}

/**
 * Why: #367 — a provider error is often wrapped before it reaches the pipeline
 * (OpenRouterService.generate wraps each attempt's error; the article analyzer
 * rethrows with a prefix), so a top-level instanceof check alone would miss it.
 * What: True when `error` or any error it wraps is a ProviderApiError.
 * Test: `providerApiStatusOf` cases in lib/services/provider-api-error.test.ts.
 */
export function isProviderApiError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < MAX_CHAIN_DEPTH && current; depth++) {
    if (current instanceof ProviderApiError) return true;
    current = innerError(current);
  }
  return false;
}

/**
 * Why: #367 — see isProviderApiError().
 * What: The HTTP status of the first ProviderApiError in `error`'s wrapping chain
 * that carries one, or undefined when the chain holds no provider status.
 * Test: `providerApiStatusOf` cases in lib/services/provider-api-error.test.ts.
 */
export function providerApiStatusOf(error: unknown): number | undefined {
  let current = error;
  for (let depth = 0; depth < MAX_CHAIN_DEPTH && current; depth++) {
    if (current instanceof ProviderApiError && current.status !== undefined) return current.status;
    current = innerError(current);
  }
  return undefined;
}
