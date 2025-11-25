/**
 * Retry with Exponential Backoff
 * Provides retry logic with configurable backoff strategy and timeout handling
 */

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in milliseconds before first retry (default: 1000ms) */
  initialDelayMs?: number;

  /** Maximum delay in milliseconds between retries (default: 10000ms) */
  maxDelayMs?: number;

  /** Backoff multiplier for exponential growth (default: 2) */
  backoffMultiplier?: number;

  /** Timeout in milliseconds for each attempt (default: 30000ms) */
  timeoutMs?: number;

  /** Callback function called before each retry */
  onRetry?: (attempt: number, error: Error) => void;

  /** Predicate to determine if error should trigger retry (default: retry all) */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Retry result containing success status and metadata
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;

  /** Result data if successful */
  data?: T;

  /** Last error if failed */
  error?: Error;

  /** Number of attempts made */
  attempts: number;

  /** Total duration in milliseconds */
  totalDurationMs: number;

  /** Details of each attempt */
  attemptDetails?: Array<{
    attempt: number;
    success: boolean;
    durationMs: number;
    error?: string;
  }>;
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to retry result
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error('API error');
 *     return response.json();
 *   },
 *   {
 *     maxAttempts: 3,
 *     initialDelayMs: 1000,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}: ${error.message}`);
 *     }
 *   }
 * );
 *
 * if (result.success) {
 *   console.log('Data:', result.data);
 * } else {
 *   console.error('Failed after retries:', result.error);
 * }
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    timeoutMs = 30000,
    onRetry,
    shouldRetry = () => true, // By default, retry all errors
  } = options;

  const startTime = Date.now();
  const attemptDetails: RetryResult<T>['attemptDetails'] = [];
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStartTime = Date.now();

    try {
      // Wrap function in timeout promise
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);

      const attemptDuration = Date.now() - attemptStartTime;

      // Success - record details and return
      attemptDetails.push({
        attempt,
        success: true,
        durationMs: attemptDuration,
      });

      return {
        success: true,
        data: result,
        attempts: attempt,
        totalDurationMs: Date.now() - startTime,
        attemptDetails,
      };
    } catch (error) {
      lastError = error as Error;
      const attemptDuration = Date.now() - attemptStartTime;

      // Record attempt details
      attemptDetails.push({
        attempt,
        success: false,
        durationMs: attemptDuration,
        error: lastError.message,
      });

      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        // Don't retry this error - fail immediately
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalDurationMs: Date.now() - startTime,
          attemptDetails,
        };
      }

      // If this wasn't the last attempt, wait before retrying
      if (attempt < maxAttempts) {
        // Calculate delay with exponential backoff
        const delayMs = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs
        );

        // Call retry callback if provided
        onRetry?.(attempt, lastError);

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All attempts exhausted - return failure
  return {
    success: false,
    error: lastError!,
    attempts: maxAttempts,
    totalDurationMs: Date.now() - startTime,
    attemptDetails,
  };
}

/**
 * Create a retry-enabled version of an async function
 *
 * @param fn - Async function to wrap with retry logic
 * @param options - Retry configuration options
 * @returns Wrapped function that automatically retries on failure
 *
 * @example
 * ```typescript
 * const fetchWithRetry = withRetry(
 *   async (url: string) => {
 *     const response = await fetch(url);
 *     if (!response.ok) throw new Error('Fetch failed');
 *     return response.json();
 *   },
 *   { maxAttempts: 3, initialDelayMs: 1000 }
 * );
 *
 * const result = await fetchWithRetry('https://api.example.com/data');
 * ```
 */
export function withRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<RetryResult<TResult>> {
  return (...args: TArgs) => retryWithBackoff(() => fn(...args), options);
}

/**
 * Common error predicates for shouldRetry option
 */
export const RetryPredicates = {
  /**
   * Retry on network errors only
   */
  networkErrors: (error: Error): boolean => {
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('timeout')
    );
  },

  /**
   * Retry on rate limit errors (429)
   */
  rateLimitErrors: (error: Error): boolean => {
    return (
      error.message.includes('429') ||
      error.message.includes('rate limit') ||
      error.message.includes('too many requests')
    );
  },

  /**
   * Retry on server errors (5xx) but not client errors (4xx)
   */
  serverErrors: (error: Error): boolean => {
    const statusMatch = error.message.match(/\b([45]\d{2})\b/);
    if (!statusMatch) return true; // Retry if no status code found

    const statusCode = parseInt(statusMatch[1], 10);
    return statusCode >= 500; // Only retry 5xx errors
  },

  /**
   * Retry on transient errors (network, timeout, 5xx, rate limit)
   */
  transientErrors: (error: Error): boolean => {
    return (
      RetryPredicates.networkErrors(error) ||
      RetryPredicates.rateLimitErrors(error) ||
      RetryPredicates.serverErrors(error)
    );
  },
};
