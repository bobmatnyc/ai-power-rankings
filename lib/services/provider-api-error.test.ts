/**
 * ProviderApiError chain lookup (#367).
 *
 * Why: a provider's HTTP status must survive the wrapping between the client and the
 * pipeline (Jina's "Failed to fetch article" prefix, OpenRouterService's per-attempt
 * wrapper), or a provider 401 is read back as text and mistaken for a site refusal.
 * What: Table test for isProviderApiError and providerApiStatusOf.
 * Test: `npx vitest run lib/services/provider-api-error.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { isProviderApiError, ProviderApiError, providerApiStatusOf } from "./provider-api-error";
import { OpenRouterError } from "./openrouter.service";

const tavily401 = new ProviderApiError("tavily", 401, "Tavily API error: 401 - invalid key");

describe("providerApiStatusOf (#367)", () => {
  it.each([
    ["a ProviderApiError", tavily401, true, 401],
    ["an Error wrapping one through cause", new Error("Failed to fetch: x", { cause: tavily401 }), true, 401],
    [
      "an OpenRouterError wrapper over an HTTP-level OpenRouterError",
      new OpenRouterError("generation failed", undefined, false, new OpenRouterError("User not found.", 403, false)),
      true,
      403,
    ],
    ["a plain Error carrying 401 in its text", new Error("Extraction failed: 401 Unauthorized"), false, undefined],
    ["a non-error value", "401", false, undefined],
  ] as const)("%s", (_label, error, isProvider, status) => {
    expect(isProviderApiError(error)).toBe(isProvider);
    expect(providerApiStatusOf(error)).toBe(status);
  });
});
