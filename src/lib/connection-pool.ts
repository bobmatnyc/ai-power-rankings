/**
 * Connection pool management for optimized database access
 */

import { loggers } from "@/lib/logger";

interface PoolStats {
  active: number;
  idle: number;
  waiting: number;
  total: number;
}

class ConnectionPoolManager {
  private stats: PoolStats = {
    active: 0,
    idle: 0,
    waiting: 0,
    total: 0,
  };

  private maxConnections: number;
  private connectionTimeout: number;
  private idleTimeout: number;

  constructor() {
    this.maxConnections = parseInt(process.env.DATABASE_POOL_MAX || "10");
    this.connectionTimeout = parseInt(process.env.DATABASE_CONNECT_TIMEOUT || "10000");
    this.idleTimeout = parseInt(process.env.DATABASE_IDLE_TIMEOUT || "10000");
  }

  /**
   * Get current pool statistics
   */
  getStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * Check if pool is healthy
   */
  isHealthy(): boolean {
    return (
      this.stats.active < this.maxConnections &&
      this.stats.waiting === 0
    );
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire<T>(operation: () => Promise<T>): Promise<T> {
    if (this.stats.active >= this.maxConnections) {
      this.stats.waiting++;
      loggers.db.warn("Connection pool at capacity", this.stats);
    }

    this.stats.active++;
    this.stats.total++;

    try {
      // Add timeout to prevent hanging connections
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timeout")),
          this.connectionTimeout
        )
      );

      const result = await Promise.race([operation(), timeoutPromise]);
      
      this.stats.active--;
      this.stats.idle++;
      
      return result;
    } catch (error) {
      this.stats.active--;
      loggers.db.error("Connection pool error", { error, stats: this.stats });
      throw error;
    } finally {
      if (this.stats.waiting > 0) {
        this.stats.waiting--;
      }
    }
  }

  /**
   * Reset pool statistics (for testing)
   */
  reset(): void {
    this.stats = {
      active: 0,
      idle: 0,
      waiting: 0,
      total: 0,
    };
  }
}

// Export singleton instance
export const connectionPool = new ConnectionPoolManager();

// Log pool stats periodically in development
if (process.env.NODE_ENV === "development") {
  setInterval(() => {
    const stats = connectionPool.getStats();
    if (stats.active > 0 || stats.total > 0) {
      loggers.db.debug("Connection pool stats", stats);
    }
  }, 30000); // Every 30 seconds
}