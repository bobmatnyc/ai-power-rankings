/**
 * Tests for the shared completion reader and JSON extractor (issue #172).
 *
 * Why: A reply cut off at max_tokens and a reply wrapped in prose both surfaced as
 *   "AI response was not valid JSON"; these pin the two apart.
 * What: `readCompletion` throws only on finish_reason "length" and logs no content;
 *   `extractJsonObject` accepts fenced or prose-wrapped objects and rejects cut-off ones.
 * Test: `npx vitest run lib/services/llm-completion.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LlmJsonParseError,
  LlmTruncatedResponseError,
  extractJsonObject,
  readCompletion,
} from "./llm-completion";

const CONTEXT = { label: "Test", model: "anthropic/claude-sonnet-5.5", maxTokens: 4000 };

function completion(content: string, finishReason?: string): unknown {
  return {
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage: { prompt_tokens: 5000, completion_tokens: 4000 },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readCompletion", () => {
  it("returns content and diagnostics for finish_reason stop, logging no content", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { content, diagnostics } = readCompletion(completion('{"secret":"body"}', "stop"), CONTEXT);

    expect(content).toBe('{"secret":"body"}');
    expect(diagnostics).toMatchObject({
      model: "anthropic/claude-sonnet-5.5",
      finishReason: "stop",
      contentLength: 17,
      completionTokens: 4000,
      maxTokens: 4000,
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret");
  });

  it("throws LlmTruncatedResponseError for finish_reason length", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => readCompletion(completion('{"title":"cut', "length"), CONTEXT)).toThrow(
      LlmTruncatedResponseError
    );
    expect(() => readCompletion(completion('{"title":"cut', "length"), CONTEXT)).toThrow(
      /finish_reason=length, model=anthropic\/claude-sonnet-5\.5, completion_tokens=4000, max_tokens=4000/
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("cut");
  });

  it("treats a missing finish_reason and missing content as unknown, not truncation", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { content, diagnostics } = readCompletion({ choices: [{ message: {} }] }, CONTEXT);
    expect(content).toBe("");
    expect(diagnostics.finishReason).toBeNull();
  });
});

describe("extractJsonObject", () => {
  it.each([
    ["bare", '{"a":1,"b":"x"}'],
    ["fenced", '```json\n{"a":1,"b":"x"}\n```'],
    ["prose before a fence", 'Here is the analysis:\n\n```json\n{"a":1,"b":"x"}\n```'],
    ["prose after", '{"a":1,"b":"x"}\n\nLet me know if you need anything else.'],
    ["uppercase fence, no newline", '```JSON {"a":1,"b":"x"}```'],
  ])("parses a %s object", (_name, text) => {
    expect(extractJsonObject(text)).toEqual({ a: 1, b: "x" });
  });

  it("ignores braces, quotes and fences inside string values", () => {
    const text = '```json\n{"a":"brace } and \\" quote and ```code```","b":{"c":[1]}}\n```';
    expect(extractJsonObject(text)).toEqual({
      a: 'brace } and " quote and ```code```',
      b: { c: [1] },
    });
  });

  it.each([
    ["unterminated", '{"title":"Anthropic Makes Code Review","summary":"The preview period was used to'],
    ["unterminated", '```json\n{"title":"t","tags":["a",'],
    ["no_object", "I cannot analyze this article."],
    ["invalid", '{"sentiment": 0.8, // -1 to 1\n}'],
  ])("rejects %s input without repairing it", (reason, text) => {
    expect(() => extractJsonObject(text)).toThrow(LlmJsonParseError);
    try {
      extractJsonObject(text);
    } catch (error) {
      expect((error as LlmJsonParseError).reason).toBe(reason);
    }
  });
});
