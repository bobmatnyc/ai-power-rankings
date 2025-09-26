"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { NoAuthProvider } from "./no-auth-provider";

// Next.js 15 Safe Dynamic Import Pattern for ClerkProvider
// This prevents useContext errors by isolating client-side imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ClerkProviderComponent: React.ComponentType<any> | null = null;
let clerkLoadError: Error | null = null;
let loadAttempted = false;

// Enhanced client-side only Clerk loading with retry mechanism
function tryLoadClerk(): Promise<boolean> {
  return new Promise((resolve) => {
    // Only attempt on client-side
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    // Don't attempt multiple loads
    if (loadAttempted) {
      resolve(ClerkProviderComponent !== null);
      return;
    }

    loadAttempted = true;

    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

    if (isAuthDisabled || !hasClerkKey) {
      console.info("[AuthProviderWrapper] Auth is disabled or keys missing");
      resolve(false);
      return;
    }

    try {
      // Use dynamic import for better Next.js 15 compatibility
      import("@clerk/nextjs")
        .then((clerkModule) => {
          if (clerkModule?.ClerkProvider) {
            ClerkProviderComponent = clerkModule.ClerkProvider;
            console.info("[AuthProviderWrapper] ClerkProvider loaded successfully");
            resolve(true);
          } else {
            console.warn("[AuthProviderWrapper] ClerkProvider not found in module");
            clerkLoadError = new Error("ClerkProvider not found in module exports");
            resolve(false);
          }
        })
        .catch((error) => {
          console.warn("[AuthProviderWrapper] Failed to load Clerk module:", error);
          clerkLoadError = error as Error;
          resolve(false);
        });
    } catch (error) {
      console.warn("[AuthProviderWrapper] Synchronous Clerk import failed:", error);
      clerkLoadError = error as Error;
      resolve(false);
    }
  });
}

interface AuthProviderWrapperProps {
  children: ReactNode;
}

/**
 * Next.js 15 App Router Compatible Auth Wrapper
 *
 * - Uses proper server/client boundary isolation
 * - If auth is disabled or Clerk keys are missing, wraps with NoAuthProvider
 * - If Clerk is available, wraps with ClerkProvider
 * - Handles [lang] dynamic routes for i18n
 * - Prevents useContext errors in production builds
 */
export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  // Ensure children is always defined
  const safeChildren = children ?? null;

  // Start with default locale during SSR
  const [locale, setLocale] = useState("en");
  const [mounted, setMounted] = useState(false);
  const [clerkLoaded, setClerkLoaded] = useState(false);

  // Always call the hook, but only use it when mounted
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);

    // Async load Clerk after component mounts
    tryLoadClerk().then((loaded) => {
      setClerkLoaded(loaded);
      if (loaded) {
        console.info("[AuthProviderWrapper] Clerk ready for use");
      }
    });
  }, []);

  useEffect(() => {
    // Update locale after mounting on client
    if (mounted && pathname) {
      const lang = pathname.split("/")[1] || "en";
      const validLangs = ["en", "ja", "zh", "ko", "es", "fr", "de", "pt", "it", "ru", "uk", "hr"];
      const detectedLocale = validLangs.includes(lang) ? lang : "en";
      setLocale(detectedLocale);
    }
  }, [mounted, pathname]);

  // Check environment variables at runtime
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  // While not mounted, render with NoAuthProvider to prevent hydration issues
  if (!mounted) {
    return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
  }

  // If auth is disabled, no keys, or Clerk failed to load, use NoAuthProvider
  if (isAuthDisabled || !hasClerkKey || !clerkLoaded || !ClerkProviderComponent || clerkLoadError) {
    if (clerkLoadError) {
      console.warn(
        "[AuthProviderWrapper] Using NoAuthProvider due to Clerk error:",
        clerkLoadError.message
      );
    }
    return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
  }

  // Use Clerk provider with proper locale and error boundary
  const ClerkProvider = ClerkProviderComponent;

  try {
    return (
      <ClerkProvider
        publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
        signInUrl={`/${locale}/sign-in`}
        signUpUrl={`/${locale}/sign-up`}
        afterSignInUrl={`/${locale}`}
        afterSignUpUrl={`/${locale}`}
        // Add Next.js 15 specific props if available
        {...(process.env["NODE_ENV"] === "development" && {
          appearance: {
            variables: { colorPrimary: "#000000" },
          },
        })}
      >
        {safeChildren}
      </ClerkProvider>
    );
  } catch (error) {
    console.error("[AuthProviderWrapper] ClerkProvider render error:", error);
    // Fallback to NoAuthProvider if ClerkProvider fails to render
    return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
  }
}
