"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type React from "react";
import { useEffect, useState } from "react";

interface ClerkProviderClientProps {
  children: React.ReactNode;
}

/**
 * Client-side ClerkProvider wrapper that prevents SSR issues.
 * This component ensures ClerkProvider only renders on the client side,
 * avoiding the useContext error during static generation.
 *
 * CRITICAL: All hooks must be called before any conditional logic
 * to comply with React's Rules of Hooks and prevent Error #310.
 */
export default function ClerkProviderClient({ children }: ClerkProviderClientProps) {
  // CRITICAL: Call ALL hooks first, before ANY conditional returns
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Set a global flag indicating whether ClerkProvider is available
    // This MUST be set before any auth components try to render
    if (typeof window !== "undefined") {
      // Initialize the flag as false - will be set to true only if ClerkProvider renders
      (window as any).__clerkProviderAvailable = false;

      // Set up a getter/setter trap for window.Clerk
      let clerkInstance: any = null;

      Object.defineProperty(window, 'Clerk', {
        get() {
          return clerkInstance;
        },
        set(value) {
          if (value && !clerkInstance) {
            // Clerk is being initialized - wrap the methods immediately
            const originalOpenSignIn = value.openSignIn?.bind(value);
            const originalOpenSignUp = value.openSignUp?.bind(value);

            if (originalOpenSignIn) {
              value.openSignIn = function(...args: any[]) {
                if (value.user) {
                  console.warn('[ClerkProvider] Prevented openSignIn - user already signed in');
                  return Promise.resolve();
                }
                return originalOpenSignIn(...args);
              };
            }

            if (originalOpenSignUp) {
              value.openSignUp = function(...args: any[]) {
                if (value.user) {
                  console.warn('[ClerkProvider] Prevented openSignUp - user already signed in');
                  return Promise.resolve();
                }
                return originalOpenSignUp(...args);
              };
            }
          }
          clerkInstance = value;
        },
        configurable: true
      });
    }
  }, []);

  // Now calculate all conditions AFTER hooks are called
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

  const isAllowedDomain =
    isClient &&
    typeof window !== "undefined" &&
    (window.location.hostname === "aipowerranking.com" ||
      window.location.hostname === "www.aipowerranking.com" ||
      window.location.hostname === "staging.aipowerranking.com" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      // Allow all Vercel preview/staging deployments
      window.location.hostname.endsWith(".vercel.app"));

  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  // Determine whether to render ClerkProvider
  const shouldRenderClerk = isClient && !isAuthDisabled && isAllowedDomain && hasClerkKey;

  // Log the decision (only on client side)
  useEffect(() => {
    if (isClient) {
      if (isAuthDisabled) {
        console.info("ClerkProvider: Disabled via NEXT_PUBLIC_DISABLE_AUTH");
      } else if (!isAllowedDomain) {
        console.info("ClerkProvider: Disabled for non-allowed domain");
      } else if (!hasClerkKey) {
        console.warn("ClerkProvider: No publishable key found");
      }
    }
  }, [isClient, isAuthDisabled, isAllowedDomain, hasClerkKey]);

  // Set the global flag based on whether we're rendering ClerkProvider
  useEffect(() => {
    if (isClient && typeof window !== "undefined") {
      (window as any).__clerkProviderAvailable = shouldRenderClerk;
      console.info(`[ClerkProvider] Provider availability: ${shouldRenderClerk}`);
    }
  }, [isClient, shouldRenderClerk]);

  // SINGLE RETURN STATEMENT - ensures consistent hook execution
  if (shouldRenderClerk) {
    // Support both Core 2 (FALLBACK_REDIRECT_URL) and legacy (AFTER_SIGN_X_URL) naming
    const signInFallbackUrl =
      process.env["NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL"] ||
      process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL"] ||
      "/en/admin";

    const signUpFallbackUrl =
      process.env["NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL"] ||
      process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL"] ||
      "/en/admin";

    return (
      <ClerkProvider
        publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
        signInUrl={process.env["NEXT_PUBLIC_CLERK_SIGN_IN_URL"] || "/en/sign-in"}
        signUpUrl={process.env["NEXT_PUBLIC_CLERK_SIGN_UP_URL"] || "/en/sign-up"}
        signInFallbackRedirectUrl={signInFallbackUrl}
        signUpFallbackRedirectUrl={signUpFallbackUrl}
        appearance={{
          variables: {
            colorPrimary: "#000000",
          },
          elements: {
            formButtonPrimary: 'bg-primary hover:bg-primary-hover text-white',
            card: 'shadow-none',
          },
        }}
        allowedRedirectOrigins={(() => {
          const origins = [
            // Production domains
            "https://aipowerranking.com",
            "https://www.aipowerranking.com",
            // Staging domains
            "https://staging.aipowerranking.com",
            // Local development
            "http://localhost:3000",
            "http://localhost:3008",
            "http://localhost:3011",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3008",
            "http://127.0.0.1:3011",
          ];

          // Add Vercel preview deployments dynamically (client-side only)
          if (typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app")) {
            origins.push(`https://${window.location.hostname}`);
          }

          return origins;
        })()}
        // Prevent automatic modal opening when user is already signed in
        signInForceRedirectUrl={undefined}
        signUpForceRedirectUrl={undefined}
      >
        {children}
      </ClerkProvider>
    );
  }

  // biome-ignore lint/complexity/noUselessFragments: Fragment needed for consistent return type
  return <>{children}</>;
}
