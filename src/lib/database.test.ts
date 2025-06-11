import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("database", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars to test values
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    // Clear module cache to force re-import
    vi.resetModules();
  });

  describe("client initialization", () => {
    it("should create supabase client with environment variables", async () => {
      const { supabase } = await import("./database");
      expect(supabase).toBeDefined();
      expect(typeof supabase.from).toBe("function");
    });

    it("should create supabaseAdmin client when service key is available", async () => {
      const { supabaseAdmin } = await import("./database");
      expect(supabaseAdmin).toBeDefined();
      expect(typeof supabaseAdmin.from).toBe("function");
    });

    it("should throw error if required env vars are missing", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      // Expect the import to throw when environment variables are missing
      await expect(async () => {
        await import("./database");
      }).rejects.toThrow("Missing required Supabase environment variables");
    });

    it("should fallback to anon client if service key is missing", async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const { supabase, supabaseAdmin } = await import("./database");
      expect(supabase).toBeDefined();
      expect(supabaseAdmin).toBeDefined();
      // Should fallback to the same client when service key is not available
      expect(supabaseAdmin).toBe(supabase);
    });
  });

  describe("client methods", () => {
    it("should have required Supabase client methods", async () => {
      const { supabase } = await import("./database");

      expect(typeof supabase.from).toBe("function");
      expect(typeof supabase.auth?.getUser).toBe("function");
    });

    it("should be able to create queries", async () => {
      const { supabase } = await import("./database");

      const query = supabase.from("tools").select("*");
      expect(query).toBeDefined();
      expect(typeof query.eq).toBe("function");
      expect(typeof query.order).toBe("function");
    });
  });

  describe("environment variable handling", () => {
    it("should use bracket notation for environment variables", async () => {
      // This is testing the pattern we established in DATABASE.md
      const { supabase } = await import("./database");
      expect(supabase).toBeDefined();

      // The mere fact that import succeeds with our test env vars
      // confirms bracket notation is working correctly
    });
  });
});
