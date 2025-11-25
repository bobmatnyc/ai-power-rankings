/**
 * Retry Logic with Exponential Backoff
 * Handles transient failures with configurable retry strategies
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay between retries (default: 10000) */
  maxDelayMs: number;
  /** Backoff multiplier for exponential growth (default: 2) */
  backoffMultiplier: number;
  /** Overall operation timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Custom retry condition - return false to stop retrying */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback for retry events (logging, metrics) */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

/**
 * Error thrown when all retry attempts are exhausted
 *
 * Design Decision: Custom error type for retry failures
 *
 * Rationale: Allows callers to distinguish retry exhaustion from
 * other errors, enabling different error handling strategies.
 */
export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: Error,
    public allErrors: Error[]
  ) {
    super(message);
    this.name = 'RetryError';
    Object.setPrototypeOf(this, RetryError.prototype);
  }

  /**
   * Get all error messages from retry attempts
   */
  getAllErrorMessages(): string[] {
    return this.allErrors.map(e => e.message);
  }

  /**
   * Check if any attempt failed due to specific error type
   */
  hasErrorType(errorType: new (...args: any[]) => Error): boolean {
    return this.allErrors.some(e => e instanceof errorType);
  }
}

/**
 * Error thrown when operation exceeds timeout
 */
export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Operation timeout after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Default retry condition - retry on all errors
 */
function defaultShouldRetry(_error: Error, _attempt: number): boolean {
  return true;
}

/**
 * Retry a function with exponential backoff
 *
 * Performance Characteristics:
 * - Time Complexity: O(attempts) - linear in retry count
 * - Space Complexity: O(attempts) - stores error history
 *
 * Expected Performance:
 * - 3 attempts with 1s initial delay: ~7s worst case (1s + 2s + 4s)
 * - With 30s timeout: Terminates early if single attempt exceeds timeout
 *
 * Bottleneck: Network latency and API response time dominate retry overhead
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result of successful function execution
 * @throws RetryError when all attempts exhausted
 * @throws TimeoutError when operation exceeds timeout
 *
 * @example
 * ```typescript
 * const data = await retryWithExponentialBackoff(
 *   () => fetch('https://api.example.com/data'),
 *   {
 *     maxAttempts: 3,
 *     initialDelayMs: 1000,
 *     shouldRetry: (error) => error.message.includes('503'),
 *   }
 * );
 * ```
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    timeoutMs = 30000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  const errors: Error[] = [];
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Wrap function execution with timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new TimeoutError(timeoutMs!)),
            timeoutMs
          )
        ),
      ]);

      // Success - return immediately
      return result;
    } catch (error) {
      lastError = error as Error;
      errors.push(lastError);

      // Check if we should retry this error
      if (!shouldRetry(lastError, attempt)) {
        throw new RetryError(
          `Retry aborted by shouldRetry condition on attempt ${attempt}`,
          attempt,
          lastError,
          errors
        );
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );

      // Notify caller of retry
      if (onRetry) {
        onRetry(lastError, attempt, delayMs);
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // All attempts exhausted
  throw new RetryError(
    `Failed after ${maxAttempts} attempts: ${lastError.message}`,
    maxAttempts,
    lastError,
    errors
  );
}

/**
 * Retry condition for HTTP status codes
 * Retries on 5xx errors and specific 4xx errors (429 rate limit, 408 timeout)
 */
export function retryOnHttpError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Retry on server errors (5xx)
  if (message.includes('500') || message.includes('502') ||
      message.includes('503') || message.includes('504')) {
    return true;
  }

  // Retry on rate limiting and timeouts
  if (message.includes('429') || message.includes('408')) {
    return true;
  }

  // Retry on network errors
  if (message.includes('network') || message.includes('timeout') ||
      message.includes('econnreset') || message.includes('enotfound')) {
    return true;
  }

  // Don't retry on client errors (4xx except 429/408)
  return false;
}

/**
 * Create a retry wrapper with preset configuration
 * Useful for consistent retry behavior across multiple operations
 *
 * @example
 * ```typescript
 * const apiRetry = createRetryWrapper({
 *   maxAttempts: 5,
 *   shouldRetry: retryOnHttpError,
 * });
 *
 * const user = await apiRetry(() => fetchUser(id));
 * const posts = await apiRetry(() => fetchPosts(userId));
 * ```
 */
export function createRetryWrapper(
  defaultOptions: Partial<RetryOptions>
): <T>(fn: () => Promise<T>, options?: Partial<RetryOptions>) => Promise<T> {
  return async <T>(
    fn: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> => {
    return retryWithExponentialBackoff(fn, {
      ...defaultOptions,
      ...options,
    });
  };
}
