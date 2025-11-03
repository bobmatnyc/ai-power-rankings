"use client";

/**
 * Conditional Clerk component wrappers
 * Only use real Clerk components when ClerkProvider is available
 * Falls back to rendering children/nothing when not available
 */

import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";

// Check if ClerkProvider is available
function useClerkAvailable() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setIsAvailable(!!(window as any).__clerkProviderAvailable);
    }
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
  const { isAvailable, mounted } = useClerkAvailable();
  const [ClerkSignInButton, setClerkSignInButton] = useState<any>(null);

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
  const { isAvailable, mounted } = useClerkAvailable();
  const [ClerkSignedOut, setClerkSignedOut] = useState<any>(null);

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

  // During SSR, show children
  if (!mounted) {
    return <>{children}</>;
  }

  // If Clerk not available, show children (assumes signed out)
  if (!isAvailable) {
    return <>{children}</>;
  }

  // If Clerk component loaded, use it
  if (ClerkSignedOut) {
    return <ClerkSignedOut>{children}</ClerkSignedOut>;
  }

  // While loading, show children
  return <>{children}</>;
}

export function SignedInDirect({ children }: { children: ReactNode }) {
  const { isAvailable, mounted } = useClerkAvailable();
  const [ClerkSignedIn, setClerkSignedIn] = useState<any>(null);

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

  // During SSR, don't show signed-in content
  if (!mounted) {
    return null;
  }

  // If Clerk not available, don't show (assumes not signed in)
  if (!isAvailable) {
    return null;
  }

  // If Clerk component loaded, use it
  if (ClerkSignedIn) {
    return <ClerkSignedIn>{children}</ClerkSignedIn>;
  }

  // While loading, don't show
  return null;
}

export function UserButtonDirect({ afterSignOutUrl, ...props }: { afterSignOutUrl?: string; [key: string]: unknown }) {
  const { isAvailable, mounted } = useClerkAvailable();
  const [ClerkUserButton, setClerkUserButton] = useState<any>(null);

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

  // During SSR, don't show
  if (!mounted) {
    return null;
  }

  // If Clerk not available, don't show
  if (!isAvailable) {
    return null;
  }

  // If Clerk component loaded, use it
  if (ClerkUserButton) {
    return <ClerkUserButton afterSignOutUrl={afterSignOutUrl} {...props} />;
  }

  // While loading, don't show
  return null;
}
