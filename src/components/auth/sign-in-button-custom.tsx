"use client";

import { useClerk } from "@clerk/nextjs";
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
  const { openSignIn } = useClerk();

  const handleClick = useCallback(() => {
    console.log("SignInButtonCustom clicked", { mode, openSignIn });

    if (mode === "modal") {
      try {
        openSignIn({
          redirectUrl: forceRedirectUrl || redirectUrl || window.location.href,
          signUpFallbackRedirectUrl:
            signUpForceRedirectUrl || forceRedirectUrl || redirectUrl || window.location.href,
        });
      } catch (error) {
        console.error("Error opening sign in modal:", error);
      }
    } else {
      // For redirect mode, navigate to the sign-in page
      const signInUrl = forceRedirectUrl || redirectUrl || "/sign-in";
      window.location.href = signInUrl;
    }
  }, [openSignIn, mode, redirectUrl, forceRedirectUrl, signUpForceRedirectUrl]);

  // Clone the child element and add onClick handler
  if (React.isValidElement(children)) {
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
