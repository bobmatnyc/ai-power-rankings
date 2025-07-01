import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { 
  getClientIP, 
  isAdminUser, 
  checkContactFormRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  RATE_LIMITS 
} from "@/lib/rate-limit";

// Mock Vercel KV
vi.mock("@vercel/kv", () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

// Mock Upstash Ratelimit
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn(),
    prefix: "test_prefix",
  })),
}));

describe("Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getClientIP", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const request = {
        headers: {
          get: vi.fn((header) => {
            if (header === "x-forwarded-for") {return "192.168.1.1, 10.0.0.1";}
            return null;
          }),
        },
        ip: "127.0.0.1",
      } as unknown as NextRequest;

      const ip = getClientIP(request);
      expect(ip).toBe("192.168.1.1");
    });

    it("should extract IP from x-real-ip header when x-forwarded-for is not available", () => {
      const request = {
        headers: {
          get: vi.fn((header) => {
            if (header === "x-real-ip") {return "192.168.1.2";}
            return null;
          }),
        },
        ip: "127.0.0.1",
      } as unknown as NextRequest;

      const ip = getClientIP(request);
      expect(ip).toBe("192.168.1.2");
    });

    it("should extract IP from cf-connecting-ip header when others are not available", () => {
      const request = {
        headers: {
          get: vi.fn((header) => {
            if (header === "cf-connecting-ip") {return "192.168.1.3";}
            return null;
          }),
        },
        ip: "127.0.0.1",
      } as unknown as NextRequest;

      const ip = getClientIP(request);
      expect(ip).toBe("192.168.1.3");
    });

    it("should fallback to request.ip when headers are not available", () => {
      const request = {
        headers: {
          get: vi.fn(() => null),
        },
        ip: "127.0.0.1",
      } as unknown as NextRequest;

      const ip = getClientIP(request);
      expect(ip).toBe("127.0.0.1");
    });

    it("should return 'unknown' when no IP is available", () => {
      const request = {
        headers: {
          get: vi.fn(() => null),
        },
        ip: undefined,
      } as unknown as NextRequest;

      const ip = getClientIP(request);
      expect(ip).toBe("unknown");
    });
  });

  describe("isAdminUser", () => {
    it("should return true for admin email", () => {
      expect(isAdminUser("bob@matsuoka.com")).toBe(true);
    });

    it("should return true for admin email regardless of case", () => {
      expect(isAdminUser("BOB@MATSUOKA.COM")).toBe(true);
    });

    it("should return false for non-admin email", () => {
      expect(isAdminUser("user@example.com")).toBe(false);
    });

    it("should return false for undefined email", () => {
      expect(isAdminUser(undefined)).toBe(false);
    });

    it("should return false for empty email", () => {
      expect(isAdminUser("")).toBe(false);
    });
  });

  describe("Rate Limit Configuration", () => {
    it("should have correct rate limit configurations", () => {
      expect(RATE_LIMITS.CONTACT_FORM.requests).toBe(5);
      expect(RATE_LIMITS.CONTACT_FORM.window).toBe("1 h");
      expect(RATE_LIMITS.CONTACT_FORM_STRICT.requests).toBe(2);
      expect(RATE_LIMITS.CONTACT_FORM_STRICT.window).toBe("10 m");
    });
  });

  describe("checkContactFormRateLimit", () => {
    it("should allow admin users to bypass rate limits", async () => {
      const request = {
        headers: {
          get: vi.fn(() => "192.168.1.1"),
        },
        ip: "192.168.1.1",
      } as unknown as NextRequest;

      const result = await checkContactFormRateLimit(request, "bob@matsuoka.com");
      
      expect(result.success).toBe(true);
      expect(result.limit).toBe(999);
      expect(result.remaining).toBe(999);
    });

    it("should handle rate limiting errors gracefully", async () => {
      const request = {
        headers: {
          get: vi.fn(() => "192.168.1.1"),
        },
        ip: "192.168.1.1",
      } as unknown as NextRequest;

      // Mock rate limiter to throw an error
      const { kv } = await import("@vercel/kv");
      vi.mocked(kv.get).mockRejectedValue(new Error("Redis connection failed"));

      const result = await checkContactFormRateLimit(request, "user@example.com");
      
      // Should allow request on error but log the issue
      expect(result.success).toBe(true);
      expect(result.limit).toBe(RATE_LIMITS.CONTACT_FORM.requests);
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return admin bypass status for admin users", async () => {
      const request = {
        headers: {
          get: vi.fn(() => "192.168.1.1"),
        },
        ip: "192.168.1.1",
      } as unknown as NextRequest;

      const result = await getRateLimitStatus(request, "bob@matsuoka.com");
      
      expect(result.success).toBe(true);
      expect(result.limit).toBe(999);
      expect(result.remaining).toBe(999);
    });
  });

  describe("resetRateLimit", () => {
    it("should attempt to delete rate limit keys", async () => {
      const { kv } = await import("@vercel/kv");
      vi.mocked(kv.del).mockResolvedValue(1);

      await resetRateLimit("192.168.1.1");
      
      expect(kv.del).toHaveBeenCalledTimes(3); // Should delete 3 keys
    });

    it("should handle deletion errors", async () => {
      const { kv } = await import("@vercel/kv");
      vi.mocked(kv.del).mockRejectedValue(new Error("Deletion failed"));

      await expect(resetRateLimit("192.168.1.1")).rejects.toThrow("Deletion failed");
    });
  });
});
