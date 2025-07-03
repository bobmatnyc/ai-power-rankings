import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock the logger
vi.mock("@/lib/logger", () => ({
  loggers: {
    api: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    database: {
      error: vi.fn(),
    },
  },
}));

// Mock Resend
const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

// Mock the subscribers repository
const mockSubscribersRepo = {
  getByEmail: vi.fn(),
  create: vi.fn(),
  updateSubscriber: vi.fn(),
  generateVerificationToken: vi.fn(() => "mock-verification-token-123"),
};

vi.mock("@/lib/json-db", () => ({
  getSubscribersRepo: vi.fn(() => mockSubscribersRepo),
}));

// Mock environment variables
const originalEnv = process.env;

describe("/api/newsletter/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      RESEND_API_KEY: "test-api-key",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (body: object) => {
    return {
      json: vi.fn().mockResolvedValue(body),
      headers: {
        get: vi.fn((header: string) => {
          if (header === "user-agent") return "test-agent";
          return null;
        }),
      },
      url: "http://localhost:3000/api/newsletter/subscribe",
    } as unknown as NextRequest;
  };

  describe("Successful subscriptions", () => {
    it("should successfully create a new subscription", async () => {
      // Setup mocks
      mockSubscribersRepo.getByEmail.mockResolvedValue(null);
      mockSubscribersRepo.create.mockResolvedValue(undefined);
      mockSend.mockResolvedValue({ error: null });

      const request = createMockRequest({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: "Thank you for subscribing! We'll be in touch soon.",
        resent: false,
      });

      // Verify repository interactions
      expect(mockSubscribersRepo.getByEmail).toHaveBeenCalledWith("john.doe@example.com");
      expect(mockSubscribersRepo.create).toHaveBeenCalledWith({
        email: "john.doe@example.com",
        status: "pending",
        verification_token: "mock-verification-token-123",
        metadata: {
          source: "website",
          user_agent: "test-agent",
          firstName: "John",
          lastName: "Doe",
        },
      });

      // Verify email notification sent to admin
      expect(mockSend).toHaveBeenCalledWith({
        from: "AI Power Ranking <newsletter@aipowerranking.com>",
        to: "bob@matsuoka.com",
        subject: "AI Power Ranking - New Subscription",
        html: expect.stringContaining("John Doe"),
      });
    });

    it("should handle existing subscriber attempting to resubscribe", async () => {
      // Setup mocks for existing verified subscriber
      mockSubscribersRepo.getByEmail.mockResolvedValue({
        id: "existing-id",
        email: "existing@example.com",
        status: "verified",
        verification_token: "existing-token",
        metadata: { firstName: "Jane", lastName: "Smith" },
      });

      const request = createMockRequest({
        firstName: "Jane",
        lastName: "Smith",
        email: "existing@example.com",
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toEqual({
        error: "Email already registered",
      });

      // Should not create new subscription
      expect(mockSubscribersRepo.create).not.toHaveBeenCalled();
    });

    it("should resend notification for pending subscriber", async () => {
      // Setup mocks for existing pending subscriber
      mockSubscribersRepo.getByEmail.mockResolvedValue({
        id: "pending-id",
        email: "pending@example.com",
        status: "pending",
        verification_token: "pending-token",
        metadata: { firstName: "Bob", lastName: "Wilson" },
      });
      mockSubscribersRepo.updateSubscriber.mockResolvedValue(undefined);
      mockSend.mockResolvedValue({ error: null });

      const request = createMockRequest({
        firstName: "Bob",
        lastName: "Wilson",
        email: "pending@example.com",
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: "Thank you for your interest! We already have your subscription.",
        resent: true,
      });

      // Should update subscriber metadata
      expect(mockSubscribersRepo.updateSubscriber).toHaveBeenCalledWith("pending-id", {
        metadata: {
          firstName: "Bob",
          lastName: "Wilson",
        },
      });

      // Should send notification about existing subscription
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "AI Power Ranking - Existing Subscription Attempt",
        })
      );
    });
  });

  describe("Input validation", () => {
    it("should reject missing required fields", async () => {
      const request = createMockRequest({
        firstName: "John",
        // Missing lastName and email
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: "Missing required fields",
      });
    });

    it("should reject invalid email format", async () => {
      const request = createMockRequest({
        firstName: "John",
        lastName: "Doe",
        email: "invalid-email",
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: "Invalid email format",
      });
    });

    it("should validate email format correctly", async () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "name+tag@example.org",
      ];

      for (const email of validEmails) {
        mockSubscribersRepo.getByEmail.mockResolvedValue(null);
        mockSubscribersRepo.create.mockResolvedValue(undefined);
        mockSend.mockResolvedValue({ error: null });

        const request = createMockRequest({
          firstName: "John",
          lastName: "Doe",
          email: email,
          turnstileToken: "test-token",
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });
  });

  describe("Environment configuration", () => {
    it("should reject subscription when RESEND_API_KEY is missing", async () => {
      process.env = { ...process.env, RESEND_API_KEY: undefined };

      const request = createMockRequest({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "Email service configuration error",
      });
    });

    it("should skip Turnstile verification in development", async () => {
      process.env = { ...process.env, NODE_ENV: "development" };
      mockSubscribersRepo.getByEmail.mockResolvedValue(null);
      mockSubscribersRepo.create.mockResolvedValue(undefined);
      mockSend.mockResolvedValue({ error: null });

      const request = createMockRequest({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // In development mode, Turnstile verification should be skipped
      // This test verifies the endpoint works without external API calls
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockSubscribersRepo.getByEmail.mockResolvedValue(null);
      mockSubscribersRepo.create.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "Failed to save subscription",
        debug: "Database connection failed", // Only in development
      });
    });

    it("should handle email sending errors gracefully", async () => {
      mockSubscribersRepo.getByEmail.mockResolvedValue(null);
      mockSubscribersRepo.create.mockResolvedValue(undefined);
      mockSend.mockResolvedValue({
        error: { message: "Failed to send email", statusCode: 400 },
      });

      const request = createMockRequest({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "An unexpected error occurred",
      });
    });

    it("should handle duplicate email database errors", async () => {
      mockSubscribersRepo.getByEmail.mockResolvedValue(null);
      mockSubscribersRepo.create.mockRejectedValue(new Error("Email already exists"));

      const request = createMockRequest({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        turnstileToken: "test-token",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toEqual({
        error: "Email already registered",
      });
    });

    it("should handle JSON parsing errors", async () => {
      const request = {
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
        headers: {
          get: vi.fn(() => null),
        },
        url: "http://localhost:3000/api/newsletter/subscribe",
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "An unexpected error occurred",
      });
    });
  });

  describe("Email notification content", () => {
    it("should include correct subscriber information in notification email", async () => {
      mockSubscribersRepo.getByEmail.mockResolvedValue(null);
      mockSubscribersRepo.create.mockResolvedValue(undefined);
      mockSend.mockResolvedValue({ error: null });

      const request = createMockRequest({
        firstName: "Alice",
        lastName: "Johnson",
        email: "alice.johnson@example.com",
        turnstileToken: "test-token",
      });

      await POST(request);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "AI Power Ranking <newsletter@aipowerranking.com>",
          to: "bob@matsuoka.com",
          subject: "AI Power Ranking - New Subscription",
          html: expect.stringContaining("Alice Johnson"),
        })
      );

      const emailCall = mockSend.mock.calls[0]?.[0];
      expect(emailCall?.html).toContain("alice.johnson@example.com");
      expect(emailCall?.html).toContain("New Subscription");
    });

    it("should differentiate between new and existing subscription notifications", async () => {
      mockSubscribersRepo.getByEmail.mockResolvedValue({
        id: "existing-id",
        email: "existing@example.com",
        status: "pending",
        verification_token: "existing-token",
        metadata: {},
      });
      mockSubscribersRepo.updateSubscriber.mockResolvedValue(undefined);
      mockSend.mockResolvedValue({ error: null });

      const request = createMockRequest({
        firstName: "Bob",
        lastName: "Smith",
        email: "existing@example.com",
        turnstileToken: "test-token",
      });

      await POST(request);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "AI Power Ranking - Existing Subscription Attempt",
          html: expect.stringContaining("Existing Subscriber"),
        })
      );
    });
  });
});