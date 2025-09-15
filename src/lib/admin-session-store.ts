import crypto from "node:crypto";

// In-memory session store (consider using Redis or a database in production)
// Sessions will be lost on server restart, which is acceptable for a single-instance deployment
// For production with multiple instances, use Redis or a database
class SessionStore {
  private sessions: Map<string, { token: string; createdAt: number; lastAccessed: number }> = new Map();
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up every hour
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup
    this.startCleanup();
  }

  private startCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL);
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
    this.sessions.set(token, {
      token,
      createdAt: now,
      lastAccessed: now,
    });
    // Clean up old sessions periodically
    this.cleanupExpiredSessions();
    return token;
  }

  validateSession(token: string): boolean {
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
  getSessionInfo(token: string): { createdAt: Date; lastAccessed: Date; remainingTime: string } | null {
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

  // Clean up on process exit
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.sessions.clear();
  }
}

// Export a singleton instance
export const sessionStore = new SessionStore();

// Clean up on process exit
if (typeof process !== "undefined") {
  process.on("exit", () => sessionStore.destroy());
  process.on("SIGINT", () => {
    sessionStore.destroy();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    sessionStore.destroy();
    process.exit(0);
  });
}