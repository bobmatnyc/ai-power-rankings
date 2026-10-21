/**
 * Reading an OpenRouter chat completion safely (issue #172).
 *
 * Why: After the switch to `anthropic/claude-sonnet-5.5`, the daily-news cron failed with
 *   "AI response was not valid JSON". No call site read `finish_reason`, so a reply cut off
 *   at `max_tokens` looked the same as a malformed one, and the logs could not say which.
 *   The JSON extraction only stripped ```json fences, so leading or trailing prose also failed.
 * What: `readCompletion()` pulls the first choice's content out of a parsed response, logs
 *   one diagnostic line (label, model, finish_reason, content length, token counts — never
 *   the content), and throws `LlmTruncatedResponseError` when `finish_reason` is "length".
 *   `extractJsonObject()` parses the first complete JSON object in a reply, tolerating a
 *   code fence and surrounding prose, and throws `LlmJsonParseError` for anything else. It
 *   never repairs an unterminated object.
 * Test: `npx vitest run lib/services/llm-completion.test.ts`; end to end through
 *   `AIAnalyzer.analyzeContent` in `tests/unit/ai-analyzer-truncation.test.ts`.
 */

/** Diagnostic fields for one completion. Safe to log: carries no content. */
export interface CompletionDiagnostics {
  label: string;
  model: string;
  finishReason: string | null;
  contentLength: number;
  maxTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
}

/** The provider stopped at the token budget, so the reply is incomplete. */
export class LlmTruncatedResponseError extends Error {
  constructor(public readonly diagnostics: CompletionDiagnostics) {
    super(
      `AI response truncated at the token limit (finish_reason=length, model=${diagnostics.model}, ` +
        `completion_tokens=${diagnostics.completionTokens ?? "unknown"}, ` +
        `max_tokens=${diagnostics.maxTokens ?? "unknown"}, content_length=${diagnostics.contentLength})`
    );
    this.name = "LlmTruncatedResponseError";
  }
}

export type LlmJsonParseReason = "no_object" | "unterminated" | "invalid";

/** The reply held no complete, valid JSON object. */
export class LlmJsonParseError extends Error {
  constructor(
    public readonly reason: LlmJsonParseReason,
    public readonly contentLength: number
  ) {
    super(`AI response was not valid JSON (${reason}, content_length=${contentLength})`);
    this.name = "LlmJsonParseError";
  }
}

interface ChoiceShape {
  message?: { content?: unknown };
  finish_reason?: unknown;
}

interface UsageShape {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  completion_tokens_details?: { reasoning_tokens?: unknown };
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Why: #172 — every caller needs the same truncation check and the same diagnostic line.
 * What: Returns the first choice's content (or "" when absent) and its diagnostics. Logs
 *   the diagnostics with `console.info`, or `console.error` on truncation, then throws
 *   `LlmTruncatedResponseError` when `finish_reason === "length"`. A missing
 *   `finish_reason` is reported as null and does not throw. Callers keep their own
 *   empty-content handling.
 * Test: `readCompletion` cases in lib/services/llm-completion.test.ts.
 */
export function readCompletion(
  data: unknown,
  context: { label: string; model: string; maxTokens?: number }
): { content: string; diagnostics: CompletionDiagnostics } {
  const body = (data ?? {}) as { choices?: ChoiceShape[]; usage?: UsageShape };
  const choice = Array.isArray(body.choices) ? body.choices[0] : undefined;
  const rawContent = choice?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : "";
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;

  const diagnostics: CompletionDiagnostics = {
    label: context.label,
    model: context.model,
    finishReason,
    contentLength: content.length,
    maxTokens: context.maxTokens,
    promptTokens: asNumber(body.usage?.prompt_tokens),
    completionTokens: asNumber(body.usage?.completion_tokens),
    reasoningTokens: asNumber(body.usage?.completion_tokens_details?.reasoning_tokens),
  };

  if (finishReason === "length") {
    console.error(`[${context.label}] AI response truncated at max_tokens`, diagnostics);
    throw new LlmTruncatedResponseError(diagnostics);
  }
  console.info(`[${context.label}] AI completion received`, diagnostics);
  return { content, diagnostics };
}

/**
 * Index one past the `}` that closes the object opening at `start`, or -1 when the text
 * ends first. Braces inside JSON strings (including escaped quotes) are ignored.
 */
function findObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Why: #172 — models wrap JSON in a code fence or add a sentence before or after it; the
 *   old `replace(/```json\n?|\n?```/g, "")` left that prose in place and the parse failed.
 * What: Parses the first balanced `{...}` object in the text, ignoring anything before or
 *   after it (a code fence, a sentence of prose). Throws
 *   `LlmJsonParseError` with reason "no_object" when there is no `{`, "unterminated" when
 *   the object never closes (a cut-off reply), and "invalid" when the balanced text is not
 *   JSON. It never closes or repairs a partial object.
 * Test: `extractJsonObject` cases in lib/services/llm-completion.test.ts.
 */
export function extractJsonObject(text: string): unknown {
  // A fence line ("```json") holds no "{", so scanning from the first "{" skips it, and
  // the closing fence is trailing text. A fence regex would also match ``` inside a
  // string value (rewritten_content can quote code), so none is used.
  const start = text.indexOf("{");
  if (start === -1) throw new LlmJsonParseError("no_object", text.length);
  const end = findObjectEnd(text, start);
  if (end === -1) throw new LlmJsonParseError("unterminated", text.length);

  try {
    return JSON.parse(text.slice(start, end));
  } catch {
    throw new LlmJsonParseError("invalid", text.length);
  }
}
