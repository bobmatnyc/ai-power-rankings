import pino from "pino";

// Create a logger instance that works well with Next.js
const logger = pino({
  level: process.env["LOG_LEVEL"] || "info",
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Simple JSON output for Next.js compatibility
  // Pretty printing can be added with external tools if needed
});

// Add context helpers
export const createLogger = (context: string) => {
  return logger.child({ context });
};

// Export the main logger
export { logger };

// Common logging helpers
export const loggers = {
  api: createLogger("API"),
  database: createLogger("DATABASE"),
  db: createLogger("DB"), // Add alias for database logger
  auth: createLogger("AUTH"),
  import: createLogger("IMPORT"),
  ranking: createLogger("RANKING"),
  news: createLogger("NEWS"),
  tools: createLogger("TOOLS"),
  test: createLogger("TEST"),
  migration: createLogger("MIGRATION"),
  validation: createLogger("VALIDATION"),
};

export default logger;
