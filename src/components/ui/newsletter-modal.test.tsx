import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewsletterModal } from "./newsletter-modal";

// Mock the i18n hook
const mockDict = {
  newsletter: {
    modal: {
      title: "Subscribe to AI Power Ranking",
      subtitle: "Get weekly insights on AI coding tools",
      firstName: "First Name",
      lastName: "Last Name", 
      email: "Email Address",
      thankYou: "Thank you for subscribing!",
      checkEmail: "Please check your email",
      privacyNote: "We respect your privacy and will never spam you.",
      errors: {
        captcha: "Please complete the captcha",
        failed: "Failed to subscribe. Please try again.",
      },
    },
    form: {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      subscribe: "Subscribe",
      subscribing: "Subscribing...",
    },
  },
  common: {
    cancel: "Cancel",
  },
};

vi.mock("@/i18n/client", () => ({
  useI18n: () => ({ dict: mockDict }),
}));

// Mock Turnstile component
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: vi.fn(({ onSuccess, onError, onExpire }) => (
    <div data-testid="turnstile-mock">
      <button
        data-testid="turnstile-success"
        onClick={() => onSuccess("mock-token")}
      >
        Complete Captcha
      </button>
      <button
        data-testid="turnstile-error"
        onClick={() => onError()}
      >
        Error Captcha
      </button>
      <button
        data-testid="turnstile-expire"
        onClick={() => onExpire()}
      >
        Expire Captcha
      </button>
    </div>
  )),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const originalEnv = process.env;

describe("NewsletterModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-site-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Rendering", () => {
    it("should render the modal when open", () => {
      render(<NewsletterModal {...defaultProps} />);
      
      expect(screen.getByText("Subscribe to AI Power Ranking")).toBeInTheDocument();
      expect(screen.getByText("Get weekly insights on AI coding tools")).toBeInTheDocument();
      expect(screen.getByLabelText("First Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Last Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByTestId("turnstile-mock")).toBeInTheDocument();
    });

    it("should not render when closed", () => {
      render(<NewsletterModal {...defaultProps} open={false} />);
      
      expect(screen.queryByText("Subscribe to AI Power Ranking")).not.toBeInTheDocument();
    });

    it("should render all form fields with correct placeholders", () => {
      render(<NewsletterModal {...defaultProps} />);
      
      const firstNameInput = screen.getByPlaceholderText("First Name");
      const lastNameInput = screen.getByPlaceholderText("Last Name");
      const emailInput = screen.getByPlaceholderText("Email Address");
      
      expect(firstNameInput).toBeInTheDocument();
      expect(lastNameInput).toBeInTheDocument();
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute("type", "email");
    });

    it("should have subscribe button disabled initially", () => {
      render(<NewsletterModal {...defaultProps} />);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      expect(subscribeButton).toBeDisabled();
    });
  });

  describe("Form interaction", () => {
    it("should enable subscribe button after completing captcha", async () => {
      const user = userEvent.setup();
      render(<NewsletterModal {...defaultProps} />);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      expect(subscribeButton).toBeDisabled();
      
      // Complete captcha
      const captchaButton = screen.getByTestId("turnstile-success");
      await user.click(captchaButton);
      
      expect(subscribeButton).toBeEnabled();
    });

    it("should fill out form fields correctly", async () => {
      const user = userEvent.setup();
      render(<NewsletterModal {...defaultProps} />);
      
      const firstNameInput = screen.getByLabelText("First Name");
      const lastNameInput = screen.getByLabelText("Last Name");
      const emailInput = screen.getByLabelText("Email");
      
      await user.type(firstNameInput, "John");
      await user.type(lastNameInput, "Doe");
      await user.type(emailInput, "john.doe@example.com");
      
      expect(firstNameInput).toHaveValue("John");
      expect(lastNameInput).toHaveValue("Doe");
      expect(emailInput).toHaveValue("john.doe@example.com");
    });

    it("should show captcha error when captcha fails", async () => {
      const user = userEvent.setup();
      render(<NewsletterModal {...defaultProps} />);
      
      const captchaErrorButton = screen.getByTestId("turnstile-error");
      await user.click(captchaErrorButton);
      
      expect(screen.getByText("Failed to subscribe. Please try again.")).toBeInTheDocument();
    });

    it("should clear captcha token when it expires", async () => {
      const user = userEvent.setup();
      render(<NewsletterModal {...defaultProps} />);
      
      // Complete captcha first
      const captchaSuccessButton = screen.getByTestId("turnstile-success");
      await user.click(captchaSuccessButton);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      expect(subscribeButton).toBeEnabled();
      
      // Expire captcha
      const captchaExpireButton = screen.getByTestId("turnstile-expire");
      await user.click(captchaExpireButton);
      
      expect(subscribeButton).toBeDisabled();
    });
  });

  describe("Form submission", () => {
    const fillFormAndCompleteCaptcha = async (user: ReturnType<typeof userEvent.setup>) => {
      const firstNameInput = screen.getByLabelText("First Name");
      const lastNameInput = screen.getByLabelText("Last Name");
      const emailInput = screen.getByLabelText("Email");
      
      await user.type(firstNameInput, "John");
      await user.type(lastNameInput, "Doe");
      await user.type(emailInput, "john.doe@example.com");
      
      // Complete captcha
      const captchaButton = screen.getByTestId("turnstile-success");
      await user.click(captchaButton);
    };

    it("should submit form successfully", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Please check your email to verify your subscription",
        }),
      });

      render(<NewsletterModal {...defaultProps} />);
      
      await fillFormAndCompleteCaptcha(user);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      await user.click(subscribeButton);
      
      expect(mockFetch).toHaveBeenCalledWith("/api/newsletter/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          turnstileToken: "mock-token",
        }),
      });
      
      // Should show success state
      await waitFor(() => {
        expect(screen.getByText("Thank you for subscribing!")).toBeInTheDocument();
      });
    });

    it("should show loading state during submission", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
      
      render(<NewsletterModal {...defaultProps} />);
      
      await fillFormAndCompleteCaptcha(user);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      await user.click(subscribeButton);
      
      expect(screen.getByText("Subscribing...")).toBeInTheDocument();
      expect(subscribeButton).toBeDisabled();
    });

    it("should prevent submission without captcha", async () => {
      const user = userEvent.setup();
      render(<NewsletterModal {...defaultProps} />);
      
      const firstNameInput = screen.getByLabelText("First Name");
      const lastNameInput = screen.getByLabelText("Last Name");
      const emailInput = screen.getByLabelText("Email");
      
      await user.type(firstNameInput, "John");
      await user.type(lastNameInput, "Doe");
      await user.type(emailInput, "john.doe@example.com");
      
      // Try to submit without completing captcha
      const form = screen.getByRole("dialog").querySelector("form");
      fireEvent.submit(form!);
      
      expect(screen.getByText("Please complete the captcha")).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "Email already registered",
        }),
      });
      
      render(<NewsletterModal {...defaultProps} />);
      
      await fillFormAndCompleteCaptcha(user);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      await user.click(subscribeButton);
      
      await waitFor(() => {
        expect(screen.getByText("Email already registered")).toBeInTheDocument();
      });
    });

    it("should handle network errors", async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      
      render(<NewsletterModal {...defaultProps} />);
      
      await fillFormAndCompleteCaptcha(user);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      await user.click(subscribeButton);
      
      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  describe("Success state", () => {
    const fillFormAndCompleteCaptcha = async (user: ReturnType<typeof userEvent.setup>) => {
      const firstNameInput = screen.getByLabelText("First Name");
      const lastNameInput = screen.getByLabelText("Last Name");
      const emailInput = screen.getByLabelText("Email");
      
      await user.type(firstNameInput, "John");
      await user.type(lastNameInput, "Doe");
      await user.type(emailInput, "john.doe@example.com");
      
      // Complete captcha
      const captchaButton = screen.getByTestId("turnstile-success");
      await user.click(captchaButton);
    };

    it("should show success message and auto-close modal", async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = vi.fn();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Please check your email to verify your subscription",
        }),
      });
      
      render(<NewsletterModal {...defaultProps} onOpenChange={mockOnOpenChange} />);
      
      await fillFormAndCompleteCaptcha(user);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      await user.click(subscribeButton);
      
      // Should show success state
      await waitFor(() => {
        expect(screen.getByText("Thank you for subscribing!")).toBeInTheDocument();
      });
      
      // Should auto-close after delay
      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      }, { timeout: 4000 });
    });

    it("should reset form after successful submission and close", async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = vi.fn();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Please check your email to verify your subscription",
        }),
      });
      
      render(<NewsletterModal {...defaultProps} onOpenChange={mockOnOpenChange} />);
      
      await fillFormAndCompleteCaptcha(user);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      await user.click(subscribeButton);
      
      // Wait for auto-close
      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      }, { timeout: 4000 });
      
      // Simulate re-opening the modal
      render(<NewsletterModal open={true} onOpenChange={mockOnOpenChange} />);
      
      // Form should be reset
      const firstNameInput = screen.getByLabelText("First Name");
      const lastNameInput = screen.getByLabelText("Last Name");
      const emailInput = screen.getByLabelText("Email");
      
      expect(firstNameInput).toHaveValue("");
      expect(lastNameInput).toHaveValue("");
      expect(emailInput).toHaveValue("");
    });
  });

  describe("Cancel functionality", () => {
    const fillFormAndCompleteCaptcha = async (user: ReturnType<typeof userEvent.setup>) => {
      const firstNameInput = screen.getByLabelText("First Name");
      const lastNameInput = screen.getByLabelText("Last Name");
      const emailInput = screen.getByLabelText("Email");
      
      await user.type(firstNameInput, "John");
      await user.type(lastNameInput, "Doe");
      await user.type(emailInput, "john.doe@example.com");
      
      // Complete captcha
      const captchaButton = screen.getByTestId("turnstile-success");
      await user.click(captchaButton);
    };

    it("should close modal when cancel button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = vi.fn();
      
      render(<NewsletterModal {...defaultProps} onOpenChange={mockOnOpenChange} />);
      
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelButton);
      
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it("should disable cancel button during submission", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
      
      render(<NewsletterModal {...defaultProps} />);
      
      await fillFormAndCompleteCaptcha(user);
      
      const subscribeButton = screen.getByRole("button", { name: "Subscribe" });
      await user.click(subscribeButton);
      
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper form labels and ARIA attributes", () => {
      render(<NewsletterModal {...defaultProps} />);
      
      expect(screen.getByLabelText("First Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Last Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("should mark required fields as required", () => {
      render(<NewsletterModal {...defaultProps} />);
      
      const firstNameInput = screen.getByLabelText("First Name");
      const lastNameInput = screen.getByLabelText("Last Name");
      const emailInput = screen.getByLabelText("Email");
      
      expect(firstNameInput).toBeRequired();
      expect(lastNameInput).toBeRequired();
      expect(emailInput).toBeRequired();
    });
  });
});