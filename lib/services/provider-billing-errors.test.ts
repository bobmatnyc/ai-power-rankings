import { describe, expect, it } from "vitest";

/**
 * #167: the classifier that decides whether a provider error is a billing / credit
 * failure (which must fail the run) or anything else (which must not).
 *
 * Test: `npx vitest run lib/services/provider-billing-errors.test.ts`.
 */

import {
  ProviderBillingFailures,
  providerBillingCondition,
} from "./provider-billing-errors";

describe("providerBillingCondition (#167)", () => {
  it.each([
    [
      'Tavily API error: 402 - {"detail":{"error":"Your account is currently disabled because of an unpaid pay-as-you-go balance."}}',
      "HTTP 402 Payment Required",
    ],
    ["Failed to fetch article with Jina.ai: Jina.ai API error (402): Payment Required", "HTTP 402 Payment Required"],
    ["402 InsufficientBalanceError", "HTTP 402 Payment Required"],
    [
      "OpenRouter generation failed: This request requires more credits, or fewer max_tokens. You requested up to 1000 tokens, but can only afford 648.",
      "insufficient credits",
    ],
    ["OpenRouter request failed: insufficient credits", "insufficient credits"],
  ])("classifies %s as billing", (message, condition) => {
    expect(providerBillingCondition(message)).toBe(condition);
  });

  it.each([
    "Brave Search API error: 429 Request rate limit exceeded",
    "Tavily Extract API error: 429 - Too Many Requests",
    "Jina.ai blocked by source (403): Forbidden",
    "Failed to ingest https://example.com/posts/402: Request timed out",
    "OpenRouter API error (500)",
    "Assessment failed - using default scores",
  ])("does not classify %s as billing", (message) => {
    expect(providerBillingCondition(message)).toBeNull();
  });
});

describe("ProviderBillingFailures (#167)", () => {
  it("keeps one reason per provider and names the provider and the condition", () => {
    const failures = new ProviderBillingFailures();
    failures.note("jina", "Jina.ai API error (402): Payment Required");
    failures.note("jina", "Jina.ai API error (402): Payment Required");
    failures.note("brave", "Brave Search API error: 429 Request rate limit exceeded");

    expect(failures.reasons()).toHaveLength(1);
    expect(failures.reasons()[0]).toMatch(/^Provider billing error \[jina\]: HTTP 402 Payment Required/);
  });
});
