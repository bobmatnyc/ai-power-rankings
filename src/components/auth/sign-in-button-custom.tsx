"use client";

// Don't use Clerk hooks directly - they fail if not in provider
import React, { useCallback } from "react";

interface SignInButtonCustomProps {
  children: React.ReactNode;
  mode?: "modal" | "redirect";
  redirectUrl?: string;
  forceRedirectUrl?: string;
  signUpForceRedirectUrl?: string;
}

export function SignInButtonCustom({
  children,
  mode = "modal",
  redirectUrl,
  forceRedirectUrl,
  signUpForceRedirectUrl,
}: SignInButtonCustomProps) {
  // Get Clerk from window instead of using hook to avoid provider errors
  // biome-ignore lint/suspicious/noExplicitAny: Clerk instance
  const getClerk = useCallback(() => typeof window !== "undefined" ? (window as any).Clerk : null, []);

  const handleClick = useCallback(() => {
    const clerk = getClerk();
    console.log("SignInButtonCustom clicked", { mode, clerk });

    if (mode === "modal" && clerk?.openSignIn) {
      try {
        clerk.openSignIn({
          redirectUrl: forceRedirectUrl || redirectUrl || window.location.href,
          signUpFallbackRedirectUrl:
            signUpForceRedirectUrl || forceRedirectUrl || redirectUrl || window.location.href,
        });
      } catch (error) {
        console.error("Error opening sign in modal:", error);
        // Fallback to redirect if modal fails
        window.location.href = "/sign-in";
      }
    } else {
      // For redirect mode or if Clerk not available, navigate to the sign-in page
      const signInUrl = forceRedirectUrl || redirectUrl || "/sign-in";
      window.location.href = signInUrl;
    }
  }, [mode, redirectUrl, forceRedirectUrl, signUpForceRedirectUrl, getClerk]);

  // Clone the child element and add onClick handler
  if (React.isValidElement(children)) {
    // biome-ignore lint/suspicious/noExplicitAny: React element props
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        console.log("Button onClick triggered");
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      },
    });
  }

  // Fallback to wrapping in a button
  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}
