/**
 * OpenRouter Service
 * Centralized service for OpenRouter API interactions with validation, retry logic,
 * cost tracking, and comprehensive error handling
 */

import { getOpenRouterApiKey } from '@/lib/startup-validation';
import { loggers } from '@/lib/logger';
import { retryWithBackoff, RetryPredicates, type RetryResult } from '@/lib/utils/retry-with-backoff';
import {
  validateOpenRouterResponse,
  extractOpenRouterContent,
  type OpenRouterResponse,
} from '@/lib/validation/llm-response-validator';

/**
 * OpenRouter API message structure
 */
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenRouter API request configuration
 */
export interface OpenRouterRequestConfig {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

/**
 * Generation metadata tracked for cost and performance monitoring
 */
export interface GenerationMetadata {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  durationMs: number;
  attempts: number;
  success: boolean;
  error?: string;
}

/**
 * OpenRouter pricing per 1M tokens (as of 2025)
 * Source: https://openrouter.ai/models
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4': { input: 3.0, output: 15.0 },
  'anthropic/claude-opus-4': { input: 15.0, output: 75.0 },
  'anthropic/claude-opus-4.1': { input: 15.0, output: 75.0 },
  'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'anthropic/claude-3-opus': { input: 15.0, output: 75.0 },
  'openai/gpt-4': { input: 30.0, output: 60.0 },
  'openai/gpt-4-turbo': { input: 10.0, output: 30.0 },
  'openai/gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

/**
 * Calculate estimated cost for OpenRouter API call
 * @param model - Model identifier
 * @param promptTokens - Number of prompt tokens
 * @param completionTokens - Number of completion tokens
 * @returns Estimated cost in USD
 */
export function calculateOpenRouterCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] || { input: 1.0, output: 2.0 }; // Default fallback pricing

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * OpenRouter service error with enhanced context
 */
export class OpenRouterError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = true,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

/**
 * OpenRouter API Service
 * Provides centralized, validated, retry-enabled API calls to OpenRouter
 */
export class OpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor() {
    this.apiKey = getOpenRouterApiKey();
  }

  /**
   * Call OpenRouter API with validation, retry, and cost tracking
   *
   * @param config - Request configuration
   * @param options - Optional retry configuration
   * @returns Content string and generation metadata
   */
  async generate(
    config: OpenRouterRequestConfig,
    options: {
      maxAttempts?: number;
      timeoutMs?: number;
      onRetry?: (attempt: number, error: Error) => void;
    } = {}
  ): Promise<{ content: string; metadata: GenerationMetadata }> {
    const startTime = Date.now();

    // Execute with retry logic
    const result: RetryResult<{ content: string; response: OpenRouterResponse }> =
      await retryWithBackoff(
        () => this.executeRequest(config),
        {
          maxAttempts: options.maxAttempts || 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
          timeoutMs: options.timeoutMs || 30000,
          shouldRetry: (error) => {
            // Don't retry auth errors (401), payment errors (402), or validation errors (400)
            if (error instanceof OpenRouterError) {
              return error.retryable;
            }
            // Retry transient errors (network, 5xx, rate limits)
            return RetryPredicates.transientErrors(error);
          },
          onRetry: (attempt, error) => {
            loggers.api.warn('OpenRouter API retry', {
              attempt,
              error: error.message,
              model: config.model,
            });
            options.onRetry?.(attempt, error);
          },
        }
      );

    const durationMs = Date.now() - startTime;

    // Build metadata
    const metadata: GenerationMetadata = {
      model: config.model,
      promptTokens: result.data?.response.usage?.prompt_tokens || 0,
      completionTokens: result.data?.response.usage?.completion_tokens || 0,
      totalTokens: result.data?.response.usage?.total_tokens || 0,
      estimatedCost: 0,
      durationMs,
      attempts: result.attempts,
      success: result.success,
      error: result.error?.message,
    };

    if (result.success && result.data) {
      // Calculate cost
      metadata.estimatedCost = calculateOpenRouterCost(
        config.model,
        metadata.promptTokens,
        metadata.completionTokens
      );

      loggers.api.info('OpenRouter generation successful', {
        model: config.model,
        tokens: metadata.totalTokens,
        cost: metadata.estimatedCost.toFixed(4),
        durationMs: metadata.durationMs,
        attempts: metadata.attempts,
      });

      return {
        content: result.data.content,
        metadata,
      };
    } else {
      loggers.api.error('OpenRouter generation failed after retries', {
        model: config.model,
        attempts: result.attempts,
        error: result.error?.message,
        durationMs: metadata.durationMs,
      });

      throw new OpenRouterError(
        `OpenRouter generation failed: ${result.error?.message}`,
        undefined,
        false,
        result.error
      );
    }
  }

  /**
   * Execute a single OpenRouter API request
   * @param config - Request configuration
   * @returns Content and raw response
   */
  private async executeRequest(
    config: OpenRouterRequestConfig
  ): Promise<{ content: string; response: OpenRouterResponse }> {
    const requestBody = {
      model: config.model,
      messages: config.messages,
      temperature: config.temperature ?? 0.3,
      max_tokens: config.max_tokens ?? 4000,
      top_p: config.top_p,
      frequency_penalty: config.frequency_penalty,
      presence_penalty: config.presence_penalty,
    };

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Referer: process.env['NEXT_PUBLIC_BASE_URL'] || 'http://localhost:3007',
      'HTTP-Referer': process.env['NEXT_PUBLIC_BASE_URL'] || 'http://localhost:3007',
      'X-Title': 'AI Power Rankings',
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      const retryable = this.isRetryableStatus(response.status);

      // Parse error for better messages
      let errorMessage = `OpenRouter API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        errorMessage = errorText.substring(0, 200);
      }

      throw new OpenRouterError(errorMessage, response.status, retryable);
    }

    // Parse and validate response
    const responseText = await response.text();
    let responseData: unknown;

    try {
      responseData = JSON.parse(responseText);
    } catch (error) {
      throw new OpenRouterError(
        'Invalid JSON response from OpenRouter',
        500,
        true,
        error
      );
    }

    // Validate response structure
    const validation = validateOpenRouterResponse(responseData);
    if (!validation.valid) {
      throw new OpenRouterError(
        `Invalid OpenRouter response structure: ${validation.errors?.message}`,
        500,
        false
      );
    }

    // Extract content
    const content = extractOpenRouterContent(responseData);
    if (!content) {
      throw new OpenRouterError('No content in OpenRouter response', 500, false);
    }

    return {
      content,
      response: validation.data!,
    };
  }

  /**
   * Determine if HTTP status code should trigger retry
   * @param status - HTTP status code
   * @returns Whether the error is retryable
   */
  private isRetryableStatus(status: number): boolean {
    // Retry server errors (5xx) and rate limits (429)
    if (status >= 500 || status === 429) {
      return true;
    }

    // Don't retry client errors (4xx) except rate limits
    if (status >= 400 && status < 500) {
      return false;
    }

    // Retry other errors by default
    return true;
  }
}

/**
 * Singleton instance for application-wide use
 */
let openRouterServiceInstance: OpenRouterService | null = null;

/**
 * Get or create OpenRouter service instance
 * @returns Singleton OpenRouter service
 */
export function getOpenRouterService(): OpenRouterService {
  if (!openRouterServiceInstance) {
    openRouterServiceInstance = new OpenRouterService();
  }
  return openRouterServiceInstance;
}
