"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { NoAuthProvider } from "./no-auth-provider";

// Lazy load ClerkProvider only when needed
// Using any type here is intentional as ClerkProvider has complex prop types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ClerkProviderComponent: React.ComponentType<any> | null = null;
let clerkLoadError: Error | null = null;

// Try to load Clerk at module initialization with extra safety checks
function tryLoadClerk() {
  if (typeof window === "undefined") {
    return;
  }

  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  if (!isAuthDisabled && hasClerkKey) {
    try {
      // Check if Clerk is available before requiring
      const clerkModule = require("@clerk/nextjs");
      if (clerkModule?.ClerkProvider) {
        ClerkProviderComponent = clerkModule.ClerkProvider;
      } else {
        console.warn("[AuthProviderWrapper] ClerkProvider not found in module");
        clerkLoadError = new Error("ClerkProvider not found");
      }
    } catch (error) {
      console.warn("[AuthProviderWrapper] Clerk module not available:", error);
      clerkLoadError = error as Error;
    }
  }
}

// Load Clerk safely
if (typeof window !== "undefined") {
  tryLoadClerk();
}

interface AuthProviderWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper that conditionally provides authentication context.
 * - If auth is disabled or Clerk keys are missing, wraps with NoAuthProvider
 * - If Clerk is available, wraps with ClerkProvider
 * - Handles [lang] dynamic routes for i18n
 */
export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  // Start with default locale during SSR
  const [locale, setLocale] = useState("en");
  const [mounted, setMounted] = useState(false);

  // Always call the hook, but only use it when mounted
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    // Try to load Clerk again after mounting if it wasn't loaded initially
    if (!ClerkProviderComponent && !clerkLoadError) {
      tryLoadClerk();
    }
  }, []);

  useEffect(() => {
    // Update locale after mounting on client
    if (mounted && pathname) {
      const lang = pathname.split("/")[1] || "en";
      const validLangs = ["en", "ja", "zh", "ko", "es", "fr", "de", "pt", "it", "ru"];
      const detectedLocale = validLangs.includes(lang) ? lang : "en";
      setLocale(detectedLocale);
    }
  }, [mounted, pathname]);

  // Check environment variables at runtime
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  // If auth is disabled, no keys, or Clerk failed to load, use NoAuthProvider
  if (isAuthDisabled || !hasClerkKey || !ClerkProviderComponent || clerkLoadError) {
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

  // Use Clerk provider with proper locale
  const ClerkProvider = ClerkProviderComponent;

  return (
    <ClerkProvider
      publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
      signInUrl={`/${locale}/sign-in`}
      signUpUrl={`/${locale}/sign-up`}
      afterSignInUrl={`/${locale}`}
      afterSignUpUrl={`/${locale}`}
    >
      {children}
    </ClerkProvider>
  );
}
