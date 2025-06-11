import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBuildTime, getFormattedBuildTime } from "./build-time";

describe("build-time", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BUILD_TIME;
  });

  describe("getBuildTime", () => {
    it("should return environment variable if set", () => {
      const testTime = "2025-06-11T10:00:00.000Z";
      process.env.NEXT_PUBLIC_BUILD_TIME = testTime;
      expect(getBuildTime()).toBe(testTime);
    });

    it("should return current time if environment variable not set", () => {
      const now = new Date();
      const result = getBuildTime();
      const resultDate = new Date(result);

      // Should be within 1 second of now
      expect(Math.abs(resultDate.getTime() - now.getTime())).toBeLessThan(1000);
    });

    it("should return valid ISO string", () => {
      const result = getBuildTime();
      expect(() => new Date(result)).not.toThrow();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("getFormattedBuildTime", () => {
    beforeEach(() => {
      // Mock Date.now to a fixed time for consistent testing
      vi.setSystemTime(new Date("2025-06-11T12:00:00.000Z"));
    });

    it('should return "Just now" for very recent builds', () => {
      process.env.NEXT_PUBLIC_BUILD_TIME = "2025-06-11T12:00:00.000Z";
      expect(getFormattedBuildTime()).toBe("Just now");
    });

    it("should return minutes for builds within an hour", () => {
      process.env.NEXT_PUBLIC_BUILD_TIME = "2025-06-11T11:45:00.000Z"; // 15 minutes ago
      expect(getFormattedBuildTime()).toBe("15 minutes ago");
    });

    it("should return singular minute for 1 minute ago", () => {
      process.env.NEXT_PUBLIC_BUILD_TIME = "2025-06-11T11:59:00.000Z"; // 1 minute ago
      expect(getFormattedBuildTime()).toBe("1 minute ago");
    });

    it("should return hours for builds within a day", () => {
      process.env.NEXT_PUBLIC_BUILD_TIME = "2025-06-11T09:00:00.000Z"; // 3 hours ago
      expect(getFormattedBuildTime()).toBe("3 hours ago");
    });

    it("should return singular hour for 1 hour ago", () => {
      process.env.NEXT_PUBLIC_BUILD_TIME = "2025-06-11T11:00:00.000Z"; // 1 hour ago
      expect(getFormattedBuildTime()).toBe("1 hour ago");
    });

    it('should return "Yesterday" for builds from previous day', () => {
      process.env.NEXT_PUBLIC_BUILD_TIME = "2025-06-10T12:00:00.000Z"; // 1 day ago
      expect(getFormattedBuildTime()).toBe("Yesterday");
    });

    it("should return days for builds within a week", () => {
      process.env.NEXT_PUBLIC_BUILD_TIME = "2025-06-08T12:00:00.000Z"; // 3 days ago
      expect(getFormattedBuildTime()).toBe("3 days ago");
    });

    it("should return formatted date for builds older than a week", () => {
      process.env.NEXT_PUBLIC_BUILD_TIME = "2025-06-01T12:00:00.000Z"; // 10 days ago
      expect(getFormattedBuildTime()).toBe("Jun 1");
    });

    it("should include year for builds from different year", () => {
      process.env.NEXT_PUBLIC_BUILD_TIME = "2024-06-11T12:00:00.000Z"; // 1 year ago
      expect(getFormattedBuildTime()).toBe("Jun 11, 2024");
    });
  });
});
