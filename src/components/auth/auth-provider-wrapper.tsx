"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { NoAuthProvider } from "./no-auth-provider";

// Dynamic import of ClerkProvider with proper error handling
const ClerkProviderDynamic = dynamic(
  () =>
    import("@clerk/nextjs")
      .then((mod) => ({ default: mod.ClerkProvider }))
      .catch((error) => {
        console.warn("[AuthProviderWrapper] Failed to load Clerk:", error);
        // Return NoAuthProvider as fallback
        return { default: NoAuthProvider };
      }),
  {
    ssr: false, // Disable SSR for Clerk to avoid hydration issues
    loading: () => (
      <NoAuthProvider>
        <div />
      </NoAuthProvider>
    ), // Use NoAuthProvider while loading
  }
);

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

  // Determine if we should use Clerk or NoAuth
  const shouldUseClerk = useMemo(() => {
    if (typeof window === "undefined") return false;
    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
    return !isAuthDisabled && hasClerkKey;
  }, []);

  // If auth is disabled or no keys, use NoAuthProvider
  if (!shouldUseClerk) {
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

  // Use dynamic Clerk provider with proper locale
  return (
    <ClerkProviderDynamic
      publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
      signInUrl={`/${locale}/sign-in`}
      signUpUrl={`/${locale}/sign-up`}
      afterSignInUrl={`/${locale}`}
      afterSignUpUrl={`/${locale}`}
    >
      {children}
    </ClerkProviderDynamic>
  );
}
