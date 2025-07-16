import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

// Mock the logger
vi.mock("@/lib/logger", () => ({
  loggers: {
    api: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

// Mock JSON-DB repositories for test environment
vi.mock("@/lib/json-db", () => ({
  getToolsRepo: vi.fn(() => ({
    getAll: vi.fn().mockResolvedValue([{ id: "1", name: "Test Tool" }]),
  })),
  getCompaniesRepo: vi.fn(() => ({
    getAll: vi.fn().mockResolvedValue([{ id: "1", name: "Test Company" }]),
  })),
  getRankingsRepo: vi.fn(() => ({
    getCurrentPeriod: vi.fn().mockResolvedValue("2025-07-01"),
  })),
  getNewsRepo: vi.fn(() => ({
    getAll: vi.fn().mockResolvedValue([{ id: "1", title: "Test News" }]),
  })),
}));

// Mock file system for test environment
vi.mock("fs/promises", () => ({
  access: vi.fn().mockResolvedValue(undefined), // Files exist
  stat: vi.fn().mockResolvedValue({
    size: 1024,
    mtime: new Date(),
  }),
}));

describe("/api/health", () => {
  it("should return comprehensive health check response", async () => {
    const response = await GET();
    expect(response).toBeDefined();

    const data = await response.json();
    expect(data).toMatchObject({
      status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
      timestamp: expect.any(String),
      checks: expect.objectContaining({
        dataFiles: expect.objectContaining({
          status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          message: expect.any(String),
        }),
        repositories: expect.objectContaining({
          status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          message: expect.any(String),
        }),
        memory: expect.objectContaining({
          status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          message: expect.any(String),
        }),
        cache: expect.objectContaining({
          status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          message: expect.any(String),
        }),
      }),
      system: expect.objectContaining({
        uptime: expect.any(Number),
        memory: expect.any(Object),
        version: expect.any(String),
      }),
    });
  });

  it("should return 200 status code for healthy or degraded status", async () => {
    const response = await GET();
    const data = await response.json();

    if (data.status === "unhealthy") {
      expect(response.status).toBe(503);
    } else {
      expect(response.status).toBe(200);
    }
  });

  it("should return valid ISO timestamp", async () => {
    const response = await GET();
    const data = await response.json();

    expect(typeof data.timestamp).toBe("string");
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO format

    // Should be a recent timestamp (within last minute)
    const timestamp = new Date(data.timestamp).getTime();
    const now = Date.now();
    expect(timestamp).toBeLessThanOrEqual(now);
    expect(timestamp).toBeGreaterThan(now - 60000); // Within last minute
  });
});
