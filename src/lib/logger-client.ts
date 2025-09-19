/**
 * Client-side logger for browser environments
 * This logger provides the same interface as pino but works in the browser
 */

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

interface LogFn {
  (msg: string): void;
  (msg: string, obj: any): void;
  (obj: any, msg?: string): void;
}

class ClientLogger {
  private context: string;
  private isDev = process.env.NODE_ENV === "development";

  constructor(context: string) {
    this.context = context;
  }

  private log(level: LogLevel, msg: string | any, obj?: any) {
    if (!this.isDev && level !== "error" && level !== "fatal") {
      return; // Only log errors in production
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.context}] [${level.toUpperCase()}]`;

    // Handle different argument patterns
    if (typeof msg === "object" && obj === undefined) {
      // Object first pattern: logger.info({data}, "message")
      const actualMsg = arguments[2] || "Log";
      console.log(prefix, actualMsg, msg);
    } else if (obj) {
      // Message with object pattern: logger.info("message", {data})
      console.log(prefix, msg, obj);
    } else {
      // Simple message pattern: logger.info("message")
      console.log(prefix, msg);
    }
  }

  trace: LogFn = (msg: string | any, obj?: any) => this.log("trace", msg, obj);
  debug: LogFn = (msg: string | any, obj?: any) => this.log("debug", msg, obj);
  info: LogFn = (msg: string | any, obj?: any) => this.log("info", msg, obj);
  warn: LogFn = (msg: string | any, obj?: any) => this.log("warn", msg, obj);
  error: LogFn = (msg: string | any, obj?: any) => this.log("error", msg, obj);
  fatal: LogFn = (msg: string | any, obj?: any) => this.log("fatal", msg, obj);

  child(bindings: Record<string, any>) {
    // For simplicity, just return the same logger
    // In a real implementation, you might want to merge contexts
    return new ClientLogger(`${this.context}:${Object.keys(bindings).join(",")}`);
  }
}

// Create a factory function similar to pino
function createClientLogger(context: string): ClientLogger {
  return new ClientLogger(context);
}

// Common logging helpers for client-side code
export const loggers = {
  api: createClientLogger("API"),
  database: createClientLogger("DATABASE"),
  db: createClientLogger("DB"),
  auth: createClientLogger("AUTH"),
  import: createClientLogger("IMPORT"),
  ranking: createClientLogger("RANKING"),
  news: createClientLogger("NEWS"),
  tools: createClientLogger("TOOLS"),
  test: createClientLogger("TEST"),
  migration: createClientLogger("MIGRATION"),
  validation: createClientLogger("VALIDATION"),
  backup: createClientLogger("BACKUP"),
  cache: createClientLogger("CACHE"),
  performance: createClientLogger("PERFORMANCE"),
  client: createClientLogger("CLIENT"),
} as const;

// Export a default logger
export const logger = createClientLogger("APP");

export default logger;