/**
 * Database connection utilities for handling Supabase pooler issues
 */

import { loggers } from "@/lib/logger";

export class DatabaseConnectionError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

export function isConnectionTerminationError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  // Check for Supabase/PgBouncer termination errors
  const errorStr = error.toString().toLowerCase();

  // Create a type-safe error object with optional properties
  const errorObj = error as { code?: string; severity?: string };
  const errorCode = errorObj.code?.toLowerCase() || "";

  return (
    errorStr.includes("db_termination") ||
    errorStr.includes("terminating connection") ||
    errorStr.includes("connection terminated") ||
    errorStr.includes("server closed the connection") ||
    errorStr.includes("connection reset") ||
    errorCode === "econnreset" ||
    errorCode === "57p01" || // admin_shutdown
    errorCode === "57p02" || // crash_shutdown
    errorCode === "57p03" || // cannot_connect_now
    errorCode === "xx000" || // internal_error
    errorObj.severity === "FATAL"
  );
}

export async function withConnectionRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, onRetry } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isConnectionTerminationError(error) || attempt === maxRetries) {
        throw error;
      }

      loggers.db.warn(`Database connection error, retrying (${attempt}/${maxRetries})`, {
        error: error instanceof Error ? error.message : String(error),
      });

      if (onRetry) {
        onRetry(attempt, error);
      }

      // Exponential backoff with jitter
      const delay = retryDelay * 2 ** (attempt - 1) + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new DatabaseConnectionError(
    `Database operation failed after ${maxRetries} retries`,
    lastError
  );
}

// Connection pool monitoring
let activeConnections = 0;
let totalConnections = 0;
let failedConnections = 0;

export function trackConnection(success: boolean) {
  if (success) {
    activeConnections++;
    totalConnections++;
  } else {
    failedConnections++;
  }
}

export function releaseConnection() {
  if (activeConnections > 0) {
    activeConnections--;
  }
}

export function getConnectionStats() {
  return {
    active: activeConnections,
    total: totalConnections,
    failed: failedConnections,
    successRate:
      totalConnections > 0
        ? `${(((totalConnections - failedConnections) / totalConnections) * 100).toFixed(2)}%`
        : "0%",
  };
}

// Log connection stats periodically in development (disabled)
// if (process.env["NODE_ENV"] === "development") {
//   setInterval(() => {
//     const stats = getConnectionStats();
//     if (stats.active > 0 || stats.failed > 0) {
//       loggers.db.info("Connection pool stats", stats);
//     }
//   }, 30000); // Every 30 seconds
// }
