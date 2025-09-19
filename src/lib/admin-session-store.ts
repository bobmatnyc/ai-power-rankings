import crypto from "node:crypto";

/**
 * Serverless-compatible session store for Vercel deployment
 * Uses in-memory storage with lazy cleanup (no timers)
 * Sessions expire after 24 hours of inactivity
 */
class SessionStore {
  private sessions: Map<string, { token: string; createdAt: number; lastAccessed: number }> =
    new Map();
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private lastCleanup = 0;
  private readonly MIN_CLEANUP_INTERVAL = 5 * 60 * 1000; // Cleanup at most every 5 minutes

  /**
   * Perform lazy cleanup - only when enough time has passed
   * This avoids the need for timers in serverless environments
   */
  private lazyCleanup() {
    const now = Date.now();

    // Only cleanup if enough time has passed since last cleanup
    if (now - this.lastCleanup < this.MIN_CLEANUP_INTERVAL) {
      return;
    }

    this.lastCleanup = now;
    this.cleanupExpiredSessions();
  }

  private cleanupExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.SESSION_DURATION) {
        this.sessions.delete(token);
      }
    }
  }

  createSession(): string {
    const token = crypto.randomBytes(32).toString("hex");
    const now = Date.now();

    // Perform lazy cleanup before creating new session
    this.lazyCleanup();

    this.sessions.set(token, {
      token,
      createdAt: now,
      lastAccessed: now,
    });

    return token;
  }

  validateSession(token: string): boolean {
    // Perform lazy cleanup on validation attempts
    this.lazyCleanup();

    const session = this.sessions.get(token);
    if (!session) {
      return false;
    }

    const now = Date.now();
    // Check if session has expired
    if (now - session.lastAccessed > this.SESSION_DURATION) {
      this.sessions.delete(token);
      return false;
    }

    // Update last accessed time
    session.lastAccessed = now;
    return true;
  }

  deleteSession(token: string): void {
    this.sessions.delete(token);
  }

  // Get session info for debugging (development only)
  getSessionInfo(
    token: string
  ): { createdAt: Date; lastAccessed: Date; remainingTime: string } | null {
    if (process.env["NODE_ENV"] !== "development") {
      return null;
    }

    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }

    const now = Date.now();
    const remainingMs = this.SESSION_DURATION - (now - session.lastAccessed);
    const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
    const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

    return {
      createdAt: new Date(session.createdAt),
      lastAccessed: new Date(session.lastAccessed),
      remainingTime: `${remainingHours}h ${remainingMinutes}m`,
    };
  }

  // Clean up all sessions (for testing or manual cleanup)
  destroy() {
    this.sessions.clear();
  }

  // Get active session count (for monitoring)
  getSessionCount(): number {
    this.lazyCleanup();
    return this.sessions.size;
  }
}

/**
 * Export a singleton instance
 * Note: In serverless environments, this instance may be recreated on cold starts
 * This is acceptable for our use case as sessions are validated on each request
 */
export const sessionStore = new SessionStore();

// No process event handlers needed for serverless
// The instance will be garbage collected when the function terminates
