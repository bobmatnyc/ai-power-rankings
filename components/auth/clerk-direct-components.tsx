"use client";

/**
 * Conditional Clerk component wrappers
 * Only use real Clerk components when ClerkProvider is available
 * Falls back to rendering children/nothing when not available
 */

import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useClerkAvailable as useClerkContext } from "@/contexts/clerk-context";

/**
 * Custom hook that combines Clerk context availability with SSR-safe mounting state
 *
 * This wrapper ensures:
 * 1. We use React Context to detect ClerkProvider (no global window flags)
 * 2. We track client-side mounting for SSR safety
 * 3. Components wait for hydration before rendering Clerk-dependent UI
 */
function useClerkAvailable() {
  const { isAvailable } = useClerkContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return { isAvailable, mounted };
}

export function SignInButtonDirect({
  children,
  mode = "modal",
  forceRedirectUrl,
  ...props
}: {
  children?: ReactNode;
  mode?: "modal" | "redirect";
  forceRedirectUrl?: string;
  [key: string]: unknown;
}) {
  // CRITICAL: ALL HOOKS MUST BE AT TOP LEVEL - CALLED UNCONDITIONALLY
  const { isAvailable, mounted } = useClerkAvailable();
  const [ClerkSignInButton, setClerkSignInButton] = useState<any>(null);

  // HOOK 3: Always called, condition is inside the effect
  useEffect(() => {
    if (isAvailable && mounted) {
      import("@clerk/nextjs")
        .then((clerk) => {
          setClerkSignInButton(() => clerk.SignInButton);
          console.info("[SignInButtonDirect] Clerk SignInButton loaded successfully");
        })
        .catch((err) => {
          console.warn("[SignInButtonDirect] Failed to load Clerk:", err);
        });
    }
  }, [isAvailable, mounted]);

  // ALL HOOKS ABOVE - ALL CONDITIONAL LOGIC BELOW
  // During SSR or before mount, just render children
  if (!mounted) {
    return <>{children}</>;
  }

  // If Clerk is not available, add fallback navigation to sign-in page
  if (!isAvailable) {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Get the sign-in URL from env or use default
      const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/en/sign-in';

      // Navigate to sign-in page with redirect back to current page or forceRedirectUrl
      const redirectUrl = forceRedirectUrl || (typeof window !== 'undefined' ? window.location.pathname : '/');
      window.location.href = `${signInUrl}?redirect_url=${encodeURIComponent(redirectUrl)}`;
    };

    // If children is a React element, clone it with onClick handler
    if (React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        onClick: handleClick,
        style: {
          cursor: 'pointer',
          ...((children.props as any)?.style || {})
        }
      });
    }

    // Otherwise wrap in a clickable button
    return (
      <button
        type="button"
        onClick={handleClick}
        style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
      >
        {children}
      </button>
    );
  }

  // If Clerk component loaded, use it with explicit modal mode
  if (ClerkSignInButton) {
    // Use openSignIn directly for modal mode to bypass routing
    if (mode === "modal") {
      const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Open Clerk modal directly
        if (typeof window !== "undefined" && (window as any).Clerk) {
          const clerk = (window as any).Clerk;
          if (clerk.openSignIn) {
            clerk.openSignIn({
              redirectUrl: forceRedirectUrl,
            });
          } else {
            console.error("[SignInButtonDirect] Clerk.openSignIn not available");
          }
        }
      };

      // Clone children and add onClick handler
      if (children && typeof children === 'object' && 'props' in children) {
        return <span onClick={handleClick}>{children}</span>;
      }

      return <button type="button" onClick={handleClick}>{children}</button>;
    }

    // For redirect mode, use Clerk's SignInButton component
    return (
      <ClerkSignInButton mode={mode} forceRedirectUrl={forceRedirectUrl} {...props}>
        {children}
      </ClerkSignInButton>
    );
  }

  // While loading, show children
  return <>{children}</>;
}

export function SignedOutDirect({ children }: { children: ReactNode }) {
  // CRITICAL: ALL HOOKS MUST BE AT TOP LEVEL - CALLED UNCONDITIONALLY
  const { isAvailable, mounted } = useClerkAvailable();
  const [ClerkSignedOut, setClerkSignedOut] = useState<any>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Check actual auth state from window.Clerk.user
  // HOOK 4: Always called, condition is inside the effect
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Clerk) {
      const clerk = (window as any).Clerk;

      const updateAuthState = () => {
        setIsSignedIn(!!clerk.user);
      };

      // Initial check
      updateAuthState();

      // Listen for auth changes
      clerk.addListener?.(updateAuthState);

      return () => {
        clerk.removeListener?.(updateAuthState);
      };
    }
  }, []);

  // Load Clerk component if provider is available
  // HOOK 5: Always called, condition is inside the effect
  useEffect(() => {
    if (isAvailable && mounted) {
      import("@clerk/nextjs")
        .then((clerk) => {
          setClerkSignedOut(() => clerk.SignedOut);
        })
        .catch((err) => {
          console.warn("[SignedOutDirect] Failed to load Clerk:", err);
        });
    }
  }, [isAvailable, mounted]);

  // ALL HOOKS ABOVE - ALL CONDITIONAL LOGIC BELOW
  // Don't render during SSR (assume signed out, show children)
  if (!mounted) {
    return <>{children}</>;
  }

  // If user IS signed in, don't show children
  if (isSignedIn) {
    return null;
  }

  // User is NOT signed in:

  // If ClerkProvider is available AND Clerk component loaded, use Clerk's component
  if (isAvailable && ClerkSignedOut) {
    return <ClerkSignedOut>{children}</ClerkSignedOut>;
  }

  // If ClerkProvider is NOT available OR Clerk component not loaded yet,
  // but user is signed out, just render children directly
  return <>{children}</>;
}

export function SignedInDirect({ children }: { children: ReactNode }) {
  // CRITICAL: ALL HOOKS MUST BE AT TOP LEVEL - CALLED UNCONDITIONALLY
  const { isAvailable, mounted } = useClerkAvailable();
  const [ClerkSignedIn, setClerkSignedIn] = useState<any>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Check actual auth state from window.Clerk.user
  // HOOK 4: Always called, condition is inside the effect
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Clerk) {
      const clerk = (window as any).Clerk;

      const updateAuthState = () => {
        setIsSignedIn(!!clerk.user);
      };

      // Initial check
      updateAuthState();

      // Listen for auth changes
      clerk.addListener?.(updateAuthState);

      return () => {
        clerk.removeListener?.(updateAuthState);
      };
    }
  }, []);

  // Load Clerk component if provider is available
  // HOOK 5: Always called, condition is inside the effect
  useEffect(() => {
    if (isAvailable && mounted) {
      import("@clerk/nextjs")
        .then((clerk) => {
          setClerkSignedIn(() => clerk.SignedIn);
        })
        .catch((err) => {
          console.warn("[SignedInDirect] Failed to load Clerk:", err);
        });
    }
  }, [isAvailable, mounted]);

  // ALL HOOKS ABOVE - ALL CONDITIONAL LOGIC BELOW
  // Don't render during SSR
  if (!mounted) {
    return null;
  }

  // If user is NOT signed in, don't show children
  if (!isSignedIn) {
    return null;
  }

  // User IS signed in:

  // If ClerkProvider is available AND Clerk component loaded, use Clerk's component
  if (isAvailable && ClerkSignedIn) {
    return <ClerkSignedIn>{children}</ClerkSignedIn>;
  }

  // If ClerkProvider is NOT available OR Clerk component not loaded yet,
  // but user is signed in, just render children directly
  return <>{children}</>;
}

export function UserButtonDirect({ afterSignOutUrl, ...props }: { afterSignOutUrl?: string; [key: string]: unknown }) {
  // CRITICAL: ALL HOOKS MUST BE AT TOP LEVEL - CALLED UNCONDITIONALLY
  // This prevents "Rendered more hooks than during the previous render" error
  const { isAvailable, mounted } = useClerkAvailable();
  const [userData, setUserData] = useState<any>(null);
  const [ClerkUserButton, setClerkUserButton] = useState<any>(null);

  // Check for user data from window.Clerk
  // HOOK 4: Always called, condition is inside the effect
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Clerk) {
      const clerk = (window as any).Clerk;

      const updateUserData = () => {
        setUserData(clerk.user);
      };

      updateUserData();
      clerk.addListener?.(updateUserData);

      return () => {
        clerk.removeListener?.(updateUserData);
      };
    }
  }, []);

  // ONLY load Clerk component when on authenticated pages (ClerkProvider available)
  // HOOK 5: Always called, condition is inside the effect
  useEffect(() => {
    if (isAvailable && mounted) {
      import("@clerk/nextjs")
        .then((clerk) => {
          setClerkUserButton(() => clerk.UserButton);
        })
        .catch((err) => {
          console.warn("[UserButtonDirect] Failed to load Clerk:", err);
        });
    }
  }, [isAvailable, mounted]);

  // ALL HOOKS ABOVE - ALL CONDITIONAL LOGIC BELOW
  // Don't render during SSR
  if (!mounted) {
    return null;
  }

  // If no user data, don't render
  if (!userData) {
    return null;
  }

  // CRITICAL: On public pages (no ClerkProvider), ALWAYS use fallback
  // Don't even CHECK if ClerkUserButton is loaded
  if (!isAvailable) {
    return (
      <a
        href="/sign-in"
        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={userData?.emailAddresses?.[0]?.emailAddress || "Account"}
      >
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
          {userData?.firstName?.[0]?.toUpperCase() ||
           userData?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ||
           'U'}
        </div>
        <span className="text-sm font-medium hidden sm:block">
          {userData?.firstName || 'Account'}
        </span>
      </a>
    );
  }

  // On authenticated pages: use Clerk's UserButton if loaded, otherwise show nothing
  if (ClerkUserButton) {
    return <ClerkUserButton afterSignOutUrl={afterSignOutUrl} {...props} />;
  }

  // While loading Clerk component, show nothing
  return null;
}
