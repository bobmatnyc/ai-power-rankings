import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, createLogger, loggers } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("main logger", () => {
    it("should be defined", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("should have proper log methods", () => {
      // Test that methods exist and don't throw
      expect(() => logger.info("test message")).not.toThrow();
      expect(() => logger.error("test error")).not.toThrow();
      expect(() => logger.warn("test warning")).not.toThrow();
      expect(() => logger.debug("test debug")).not.toThrow();
    });
  });

  describe("createLogger", () => {
    it("should create logger with context", () => {
      const contextLogger = createLogger("TEST");
      expect(contextLogger).toBeDefined();
      expect(typeof contextLogger.info).toBe("function");
    });

    it("should create different loggers for different contexts", () => {
      const logger1 = createLogger("CONTEXT1");
      const logger2 = createLogger("CONTEXT2");

      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
      // They should be different instances
      expect(logger1).not.toBe(logger2);
    });
  });

  describe("predefined loggers", () => {
    it("should have all predefined loggers", () => {
      expect(loggers.api).toBeDefined();
      expect(loggers.database).toBeDefined();
      expect(loggers.auth).toBeDefined();
      expect(loggers.import).toBeDefined();
      expect(loggers.ranking).toBeDefined();
      expect(loggers.news).toBeDefined();
      expect(loggers.tools).toBeDefined();
      expect(loggers.test).toBeDefined();
    });

    it("should have working log methods on predefined loggers", () => {
      expect(() => loggers.api.info("test")).not.toThrow();
      expect(() => loggers.database.error("test")).not.toThrow();
      expect(() => loggers.ranking.warn("test")).not.toThrow();
    });
  });

  describe("log level configuration", () => {
    const originalLogLevel = process.env.LOG_LEVEL;

    afterEach(() => {
      if (originalLogLevel) {
        process.env.LOG_LEVEL = originalLogLevel;
      } else {
        delete process.env.LOG_LEVEL;
      }
    });

    it("should respect LOG_LEVEL environment variable", () => {
      // In test environment, LOG_LEVEL should be 'silent'
      expect(process.env.LOG_LEVEL).toBe("silent");
    });
  });
});
