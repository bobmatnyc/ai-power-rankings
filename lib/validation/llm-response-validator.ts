/**
 * LLM Response Validation
 * Validates OpenRouter/LLM responses using Zod schemas
 */

import { z } from 'zod';

/**
 * Validation schema for LLM analysis responses
 */
export const LLMAnalysisSchema = z.object({
  content: z.string().min(100).max(50000),
  title: z.string().min(10).max(200).optional(),
  summary: z.string().max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  rewritten_content: z.string().optional(),
  source: z.string().optional(),
  url: z.string().optional().nullable(),
  published_date: z.string().optional(),
  tool_mentions: z.array(
    z.object({
      tool: z.string().optional(),
      name: z.string().optional(),
      context: z.string(),
      sentiment: z.number().min(-1).max(1),
      relevance: z.number().min(0).max(1).optional(),
    }).refine(
      (data) => data.tool || data.name,
      { message: "Either 'tool' or 'name' must be provided" }
    )
  ).optional(),
  overall_sentiment: z.number().min(-1).max(1).optional(),
  key_topics: z.array(z.string()).optional(),
  importance_score: z.number().min(0).max(10).optional(),
});

export type LLMAnalysis = z.infer<typeof LLMAnalysisSchema>;

/**
 * Validation schema for monthly report responses
 */
export const LLMMonthlyReportSchema = z.object({
  content: z.string().min(500).max(100000),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  highlights: z.array(z.string()).optional(),
  metadata: z.object({
    model: z.string(),
    generation_time_ms: z.number(),
    article_count: z.number(),
    ranking_change_count: z.number(),
    new_tool_count: z.number(),
    site_change_count: z.number(),
  }).optional(),
});

export type LLMMonthlyReport = z.infer<typeof LLMMonthlyReportSchema>;

/**
 * Validation schema for OpenRouter API responses
 */
export const OpenRouterResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
        role: z.string(),
      }),
      index: z.number(),
      finish_reason: z.string(),
    })
  ),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }).optional(),
});

export type OpenRouterResponse = z.infer<typeof OpenRouterResponseSchema>;

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: z.ZodError;
}

/**
 * Validate data against a Zod schema
 * @param schema - Zod schema to validate against
 * @param response - Data to validate
 * @returns Validation result with parsed data or errors
 */
export function validateLLMResponse<T>(
  schema: z.ZodSchema<T>,
  response: unknown
): ValidationResult<T> {
  try {
    const data = schema.parse(response);
    return { valid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error };
    }
    throw error;
  }
}

/**
 * Validate OpenRouter API response structure
 * @param response - Response from OpenRouter API
 * @returns Validated response
 */
export function validateOpenRouterResponse(response: unknown): ValidationResult<OpenRouterResponse> {
  return validateLLMResponse(OpenRouterResponseSchema, response);
}

/**
 * Extract and validate content from OpenRouter response
 * @param response - OpenRouter API response
 * @returns Content string or null if invalid
 */
export function extractOpenRouterContent(response: unknown): string | null {
  const validation = validateOpenRouterResponse(response);

  if (!validation.valid || !validation.data) {
    return null;
  }

  const content = validation.data.choices?.[0]?.message?.content;
  return content || null;
}

/**
 * Parse JSON content from LLM response (handles markdown code blocks)
 * @param content - Raw content string from LLM
 * @returns Parsed JSON object
 */
export function parseLLMJsonContent(content: string): unknown {
  // Remove markdown code blocks if present
  const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    throw new Error(`Failed to parse LLM JSON content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate and parse LLM analysis response
 * @param content - Raw content from LLM
 * @returns Validated analysis data
 */
export function validateLLMAnalysis(content: string): LLMAnalysis {
  const parsed = parseLLMJsonContent(content);
  const validation = validateLLMResponse(LLMAnalysisSchema, parsed);

  if (!validation.valid) {
    const errorMessages = validation.errors ? formatValidationErrors(validation.errors) : 'Unknown validation error';
    throw new Error(`LLM analysis validation failed: ${errorMessages}`);
  }

  return validation.data!;
}

/**
 * Format validation errors for logging
 * @param errors - Zod validation errors
 * @returns Formatted error string
 */
export function formatValidationErrors(errors: z.ZodError): string {
  if (!errors.errors || errors.errors.length === 0) {
    return errors.message || 'Validation failed';
  }

  return errors.errors
    .map(err => `${err.path.join('.')}: ${err.message}`)
    .join('; ');
}
