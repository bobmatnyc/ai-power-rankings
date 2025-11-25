/**
 * Tests for retry-with-backoff utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, RetryPredicates } from '../retry-with-backoff';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn, { maxAttempts: 3 });

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10, // Short delay for testing
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should fail after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Always fails');
    expect(result.attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should call onRetry callback', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('First fail'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      onRetry,
    });

    expect(result.success).toBe(true);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('should respect shouldRetry predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Auth failed: 401'));

    const shouldRetry = vi.fn().mockReturnValue(false); // Never retry

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      shouldRetry,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1); // Only one attempt, no retries
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should include attempt details', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
    });

    expect(result.attemptDetails).toBeDefined();
    expect(result.attemptDetails?.length).toBe(2);
    expect(result.attemptDetails?.[0].success).toBe(false);
    expect(result.attemptDetails?.[1].success).toBe(true);
  });
});

describe('RetryPredicates', () => {
  it('networkErrors should detect network errors', () => {
    expect(RetryPredicates.networkErrors(new Error('fetch failed'))).toBe(true);
    expect(RetryPredicates.networkErrors(new Error('network timeout'))).toBe(true);
    expect(RetryPredicates.networkErrors(new Error('ECONNREFUSED'))).toBe(true);
    expect(RetryPredicates.networkErrors(new Error('validation error'))).toBe(false);
  });

  it('rateLimitErrors should detect rate limit errors', () => {
    expect(RetryPredicates.rateLimitErrors(new Error('429 Too Many Requests'))).toBe(true);
    expect(RetryPredicates.rateLimitErrors(new Error('rate limit exceeded'))).toBe(true);
    expect(RetryPredicates.rateLimitErrors(new Error('server error'))).toBe(false);
  });

  it('serverErrors should detect 5xx errors', () => {
    expect(RetryPredicates.serverErrors(new Error('500 Internal Server Error'))).toBe(true);
    expect(RetryPredicates.serverErrors(new Error('503 Service Unavailable'))).toBe(true);
    expect(RetryPredicates.serverErrors(new Error('400 Bad Request'))).toBe(false);
    expect(RetryPredicates.serverErrors(new Error('401 Unauthorized'))).toBe(false);
  });

  it('transientErrors should combine multiple predicates', () => {
    expect(RetryPredicates.transientErrors(new Error('fetch failed'))).toBe(true);
    expect(RetryPredicates.transientErrors(new Error('429 rate limit'))).toBe(true);
    expect(RetryPredicates.transientErrors(new Error('503 unavailable'))).toBe(true);
    expect(RetryPredicates.transientErrors(new Error('400 bad request'))).toBe(false);
  });
});
