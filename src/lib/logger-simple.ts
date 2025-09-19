/**
 * Simple logger implementation that avoids TypeScript issues
 * Wraps console methods for server-side logging
 */

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

interface SimpleLogger {
  trace: (msg: string, ...args: any[]) => void;
  debug: (msg: string, ...args: any[]) => void;
  info: (msg: string, ...args: any[]) => void;
  warn: (msg: string, ...args: any[]) => void;
  error: (msg: string, ...args: any[]) => void;
  fatal: (msg: string, ...args: any[]) => void;
  child: (bindings: Record<string, any>) => SimpleLogger;
}

class ServerLogger implements SimpleLogger {
  private context: string;
  private logLevel = process.env["LOG_LEVEL"] || "info";

  constructor(context: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      trace: 10,
      debug: 20,
      info: 30,
      warn: 40,
      error: 50,
      fatal: 60,
    };

    const configuredLevel = levels[this.logLevel as LogLevel] || 30;
    const messageLevel = levels[level] || 30;

    return messageLevel >= configuredLevel;
  }

  private log(level: LogLevel, msg: string, ...args: any[]) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logObject = {
      level: level.toUpperCase(),
      time: timestamp,
      context: this.context,
      msg,
    };

    // Handle different argument patterns
    if (args.length === 1 && typeof args[0] === "object") {
      Object.assign(logObject, args[0]);
    } else if (args.length > 0) {
      Object.assign(logObject, { data: args });
    }

    // Use appropriate console method
    switch (level) {
      case "trace":
      case "debug":
        console.debug(JSON.stringify(logObject));
        break;
      case "info":
        console.log(JSON.stringify(logObject));
        break;
      case "warn":
        console.warn(JSON.stringify(logObject));
        break;
      case "error":
      case "fatal":
        console.error(JSON.stringify(logObject));
        break;
    }
  }

  trace(msg: string, ...args: any[]) {
    this.log("trace", msg, ...args);
  }

  debug(msg: string, ...args: any[]) {
    this.log("debug", msg, ...args);
  }

  info(msg: string, ...args: any[]) {
    this.log("info", msg, ...args);
  }

  warn(msg: string, ...args: any[]) {
    this.log("warn", msg, ...args);
  }

  error(msg: string, ...args: any[]) {
    this.log("error", msg, ...args);
  }

  fatal(msg: string, ...args: any[]) {
    this.log("fatal", msg, ...args);
  }

  child(bindings: Record<string, any>): SimpleLogger {
    return new ServerLogger(`${this.context}:${Object.keys(bindings).join(",")}`);
  }
}

// Create factory function
export function createLogger(context: string): SimpleLogger {
  return new ServerLogger(context);
}

// Common logging helpers
export const loggers = {
  api: createLogger("API"),
  database: createLogger("DATABASE"),
  db: createLogger("DB"),
  auth: createLogger("AUTH"),
  import: createLogger("IMPORT"),
  ranking: createLogger("RANKING"),
  news: createLogger("NEWS"),
  tools: createLogger("TOOLS"),
  test: createLogger("TEST"),
  migration: createLogger("MIGRATION"),
  validation: createLogger("VALIDATION"),
  backup: createLogger("BACKUP"),
  cache: createLogger("CACHE"),
  performance: createLogger("PERFORMANCE"),
  client: createLogger("CLIENT"),
};

// Export a default logger
export const logger = createLogger("APP");

export default logger;