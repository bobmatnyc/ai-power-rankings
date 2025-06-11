import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock environment variables for tests
Object.defineProperty(process.env, "NODE_ENV", {
  value: "test",
  writable: false,
});
process.env["NEXT_PUBLIC_SUPABASE_URL"] = "http://localhost:54321";
process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "test-anon-key";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-key";
process.env["LOG_LEVEL"] = "silent";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  })),
}));

// Suppress console logs during tests unless LOG_LEVEL is set
const originalConsole = { ...console };
if (process.env["LOG_LEVEL"] === "silent") {
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
}

// Restore console after tests if needed
afterAll(() => {
  if (process.env["LOG_LEVEL"] === "silent") {
    global.console = originalConsole;
  }
});
