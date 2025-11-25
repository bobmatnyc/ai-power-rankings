/**
 * LLM Response Validation
 * Validates LLM responses to prevent storing malformed/hallucinated content
 */

import { z } from 'zod';

/**
 * Expected structure from OpenRouter/Claude for monthly summaries
 *
 * Design Decision: Structured validation over free-form text
 *
 * Rationale: While Claude generates markdown text, we validate minimum
 * quality standards before storage to prevent:
 * - Empty or truncated responses
 * - Malformed content that breaks rendering
 * - Hallucinated or irrelevant summaries
 *
 * Trade-offs:
 * - Strictness: May reject valid but unconventional responses
 * - Flexibility: Allows free-form markdown within constraints
 * - Cost: Failed validations waste API tokens but prevent bad data
 */
export const LLMSummaryResponseSchema = z.object({
  // Main summary content (markdown format)
  summary: z.string()
    .min(500, 'Summary too short - minimum 500 characters for quality content')
    .max(20000, 'Summary too long - exceeds reasonable length'),

  // Optional structured highlights (if LLM provides them)
  highlights: z.array(z.string())
    .min(0)
    .max(15, 'Too many highlights')
    .optional(),

  // Optional tool-specific updates
  toolUpdates: z.array(z.object({
    toolName: z.string().min(1),
    update: z.string().min(20, 'Tool update description too short'),
    significance: z.enum(['major', 'minor', 'patch']).optional(),
  })).optional(),

  // Generation metadata
  metadata: z.object({
    articlesAnalyzed: z.number().min(0).optional(),
    toolsTracked: z.number().min(0).optional(),
    generatedAt: z.string().datetime().optional(),
  }).optional(),
});

export type LLMSummaryResponse = z.infer<typeof LLMSummaryResponseSchema>;

/**
 * Validation function with detailed errors
 *
 * @param response - Unknown LLM response to validate
 * @returns Validation result with data or errors
 */
export function validateLLMResponse(response: unknown): {
  success: boolean;
  data?: LLMSummaryResponse;
  errors?: z.ZodError;
} {
  try {
    const validated = LLMSummaryResponseSchema.parse(response);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Safe validation wrapper that never throws
 * Returns null instead of throwing for easier error handling
 */
export function validateLLMResponseSafe(response: unknown): LLMSummaryResponse | null {
  const result = validateLLMResponse(response);
  return result.success ? result.data! : null;
}

/**
 * Normalize LLM text response into validated structure
 *
 * Many LLMs return plain markdown instead of structured JSON.
 * This normalizer converts text responses into our expected schema.
 *
 * @param content - Raw LLM text response
 * @param metadata - Optional metadata to attach
 * @returns Normalized and validated response
 */
export function normalizeLLMTextResponse(
  content: string,
  metadata?: {
    articlesAnalyzed?: number;
    toolsTracked?: number;
  }
): LLMSummaryResponse {
  // Wrap plain text in our schema structure
  const normalized = {
    summary: content.trim(),
    highlights: [],
    metadata: {
      ...metadata,
      generatedAt: new Date().toISOString(),
    },
  };

  // Validate the normalized structure
  const validation = validateLLMResponse(normalized);

  if (!validation.success) {
    throw new Error(
      `LLM response validation failed: ${validation.errors?.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ')}`
    );
  }

  return validation.data!;
}

/**
 * Extract validation errors as human-readable messages
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map(error => {
    const path = error.path.join('.') || 'root';
    return `${path}: ${error.message}`;
  });
}
