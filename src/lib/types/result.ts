/**
 * Result Pattern Implementation
 * Provides explicit error handling without exceptions
 */

// ==================== Core Result Types ====================

/**
 * Result type representing either success or failure
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

/**
 * Async Result type for Promise-based operations
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// ==================== Constructor Functions ====================

/**
 * Create a successful Result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Create a failed Result
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Create an async successful Result
 */
export function okAsync<T>(data: T): AsyncResult<T, never> {
  return Promise.resolve(ok(data));
}

/**
 * Create an async failed Result
 */
export function errAsync<E>(error: E): AsyncResult<never, E> {
  return Promise.resolve(err(error));
}

// ==================== Type Guards ====================

/**
 * Check if Result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Check if Result is failure
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

// ==================== Utility Functions ====================

/**
 * Extract data from successful Result, throw if error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data;
  }
  throw result.error;
}

/**
 * Extract data from successful Result, return default if error
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isOk(result) ? result.data : defaultValue;
}

/**
 * Extract data from successful Result, compute default if error
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  return isOk(result) ? result.data : fn(result.error);
}

/**
 * Extract error from failed Result, throw if success
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) {
    return result.error;
  }
  throw new Error("Result is not an error");
}

// ==================== Transformation Functions ====================

/**
 * Transform successful Result data
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return isOk(result) ? ok(fn(result.data)) : result;
}

/**
 * Transform failed Result error
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return isErr(result) ? err(fn(result.error)) : result;
}

/**
 * Chain Results together (flatMap for Results)
 */
export function chain<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return isOk(result) ? fn(result.data) : result;
}

/**
 * Chain Results with different error types
 */
export function chainErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F> {
  return isErr(result) ? fn(result.error) : result;
}

// ==================== Async Transformation Functions ====================

/**
 * Transform async Result data
 */
export async function mapAsync<T, U, E>(
  result: AsyncResult<T, E>,
  fn: (value: T) => Promise<U> | U
): AsyncResult<U, E> {
  const resolved = await result;
  return isOk(resolved) ? ok(await fn(resolved.data)) : resolved;
}

/**
 * Transform async Result error
 */
export async function mapErrAsync<T, E, F>(
  result: AsyncResult<T, E>,
  fn: (error: E) => Promise<F> | F
): AsyncResult<T, F> {
  const resolved = await result;
  return isErr(resolved) ? err(await fn(resolved.error)) : resolved;
}

/**
 * Chain async Results together
 */
export async function chainAsync<T, U, E>(
  result: AsyncResult<T, E>,
  fn: (value: T) => AsyncResult<U, E>
): AsyncResult<U, E> {
  const resolved = await result;
  return isOk(resolved) ? fn(resolved.data) : resolved;
}

// ==================== Collection Functions ====================

/**
 * Combine array of Results into Result of array
 * Returns first error if any Result fails
 */
export function combineResults<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.data);
  }

  return ok(values);
}

/**
 * Combine async Results into Result of array
 */
export async function combineAsyncResults<T, E>(results: AsyncResult<T, E>[]): AsyncResult<T[], E> {
  const resolved = await Promise.all(results);
  return combineResults(resolved);
}

/**
 * Filter successful Results from array
 */
export function filterOk<T, E>(results: Result<T, E>[]): T[] {
  return results.filter(isOk).map((result) => result.data);
}

/**
 * Filter failed Results from array
 */
export function filterErr<T, E>(results: Result<T, E>[]): E[] {
  return results.filter(isErr).map((result) => result.error);
}

// ==================== Exception Handling ====================

/**
 * Wrap a function that might throw into a Result
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  errorHandler?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    const mappedError = errorHandler ? errorHandler(error) : (error as E);
    return err(mappedError);
  }
}

/**
 * Wrap an async function that might throw into an AsyncResult
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T> | T,
  errorHandler?: (error: unknown) => E
): AsyncResult<T, E> {
  try {
    const result = await fn();
    return ok(result);
  } catch (error) {
    const mappedError = errorHandler ? errorHandler(error) : (error as E);
    return err(mappedError);
  }
}

// ==================== Validation Helpers ====================

/**
 * Validate a value and return Result
 */
export function validate<T, E>(value: T, predicate: (value: T) => boolean, error: E): Result<T, E> {
  return predicate(value) ? ok(value) : err(error);
}

/**
 * Create a validator function that returns Results
 */
export function validator<T, E>(
  predicate: (value: T) => boolean,
  error: E
): (value: T) => Result<T, E> {
  return (value: T) => validate(value, predicate, error);
}

// ==================== Pattern Matching ====================

/**
 * Pattern match on Result
 */
export function match<T, E, U>(
  result: Result<T, E>,
  onSuccess: (data: T) => U,
  onError: (error: E) => U
): U {
  return isOk(result) ? onSuccess(result.data) : onError(result.error);
}

/**
 * Pattern match on async Result
 */
export async function matchAsync<T, E, U>(
  result: AsyncResult<T, E>,
  onSuccess: (data: T) => Promise<U> | U,
  onError: (error: E) => Promise<U> | U
): Promise<U> {
  const resolved = await result;
  return isOk(resolved) ? onSuccess(resolved.data) : onError(resolved.error);
}

// ==================== Specialized Error Types ====================

/**
 * Common application error types
 */
export interface ValidationError {
  type: "validation";
  field: string;
  message: string;
}

export interface NotFoundError {
  type: "not_found";
  resource: string;
  id?: string;
}

export interface DatabaseError {
  type: "database";
  operation: string;
  message: string;
  originalError?: Error;
}

export interface NetworkError {
  type: "network";
  url?: string;
  status?: number;
  message: string;
}

/**
 * Union type for common application errors
 */
export type AppError = ValidationError | NotFoundError | DatabaseError | NetworkError;

// ==================== Error Constructors ====================

export function validationError(field: string, message: string): ValidationError {
  return { type: "validation", field, message };
}

export function notFoundError(resource: string, id?: string): NotFoundError {
  return { type: "not_found", resource, id };
}

export function databaseError(
  operation: string,
  message: string,
  originalError?: Error
): DatabaseError {
  return { type: "database", operation, message, originalError };
}

export function networkError(message: string, url?: string, status?: number): NetworkError {
  return { type: "network", message, url, status };
}

// ==================== Type Aliases ====================

export type AppResult<T> = Result<T, AppError>;
export type AsyncAppResult<T> = AsyncResult<T, AppError>;
