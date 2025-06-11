import { describe, it, expect, vi } from "vitest";
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

describe("/api/health", () => {
  it("should return health check response", async () => {
    const response = await GET();
    expect(response).toBeDefined();

    const data = await response.json();
    expect(data).toEqual({
      status: "ok",
      timestamp: expect.any(Number),
    });
  });

  it("should return 200 status code", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("should return valid timestamp", async () => {
    const response = await GET();
    const data = await response.json();

    expect(typeof data.timestamp).toBe("number");
    expect(data.timestamp).toBeGreaterThan(0);

    // Should be a recent timestamp (within last minute)
    const now = Date.now();
    expect(data.timestamp).toBeLessThanOrEqual(now);
    expect(data.timestamp).toBeGreaterThan(now - 60000); // Within last minute
  });
});
