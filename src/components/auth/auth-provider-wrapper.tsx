"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { NoAuthProvider } from "./no-auth-provider";

// Simple flag to track if we're in a client environment
let isClientSide = false;
if (typeof window !== "undefined") {
  isClientSide = true;
}

// Simple module-level state for Clerk provider
// biome-ignore lint/suspicious/noExplicitAny: ClerkProvider has complex props
let ClerkProviderComponent: React.ComponentType<any> | null = null;
let clerkInitialized = false;

interface AuthProviderWrapperProps {
  children: ReactNode;
}

/**
 * Simplified Auth Provider Wrapper - Next.js 15 Compatible
 *
 * This implementation avoids complex async loading patterns that can cause
 * "Cannot read properties of null (reading 'useContext')" errors during SSR.
 *
 * Key principles:
 * 1. Always use NoAuthProvider during SSR
 * 2. Only attempt Clerk loading on client after hydration
 * 3. Synchronous rendering decisions to prevent module loading race conditions
 */
export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  const safeChildren = children ?? null;
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState("en");
  const pathname = usePathname();

  // Environment checks
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  useEffect(() => {
    setMounted(true);

    // Extract locale from pathname
    if (pathname) {
      const lang = pathname.split("/")[1] || "en";
      const validLangs = ["en", "ja", "zh", "ko", "es", "fr", "de", "pt", "it", "ru", "uk", "hr"];
      const detectedLocale = validLangs.includes(lang) ? lang : "en";
      setLocale(detectedLocale);
    }

    // Only attempt Clerk loading if we're in client and auth is enabled
    if (isClientSide && !isAuthDisabled && hasClerkKey && !clerkInitialized) {
      clerkInitialized = true;

      // Simple synchronous import attempt
      try {
        import("@clerk/nextjs")
          .then((clerkModule) => {
            if (clerkModule?.ClerkProvider) {
              ClerkProviderComponent = clerkModule.ClerkProvider;
              console.info("[AuthProviderWrapper] Clerk loaded successfully");
              // Force re-render after Clerk loads
              setMounted(false);
              setMounted(true);
            }
          })
          .catch((error) => {
            console.warn("[AuthProviderWrapper] Clerk import failed:", error);
          });
      } catch (error) {
        console.warn("[AuthProviderWrapper] Clerk import error:", error);
      }
    }
  }, [pathname, isAuthDisabled, hasClerkKey]);

  // During SSR or if auth is disabled, always use NoAuthProvider
  if (!mounted || isAuthDisabled || !hasClerkKey) {
    return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
  }

  // On client, if Clerk is available, use it
  if (ClerkProviderComponent && isClientSide) {
    const ClerkProvider = ClerkProviderComponent;

    try {
      return (
        <ClerkProvider
          publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
          signInUrl={`/${locale}/sign-in`}
          signUpUrl={`/${locale}/sign-up`}
          afterSignInUrl={`/${locale}`}
          afterSignUpUrl={`/${locale}`}
        >
          {safeChildren}
        </ClerkProvider>
      );
    } catch (error) {
      console.error("[AuthProviderWrapper] ClerkProvider error:", error);
      return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
    }
  }

  // Fallback to NoAuthProvider
  return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
}
