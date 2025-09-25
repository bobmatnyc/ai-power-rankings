"use client";

import {
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  SignInButton as ClerkSignInButton,
  SignUpButton as ClerkSignUpButton,
  useAuth as ClerkUseAuth,
  UserButton as ClerkUserButton,
} from "@clerk/nextjs";
import type React from "react";
import { useEffect, useState } from "react";
// import { SignInButtonCustom } from "./sign-in-button-custom"; // Removed - component no longer used
import {
  SignedIn as MockSignedIn,
  SignedOut as MockSignedOut,
  SignInButton as MockSignInButton,
  useAuth as MockUseAuth,
  UserButton as MockUserButton,
} from "./no-auth-provider";

// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

// Export the appropriate useAuth based on auth status
const useAuth = isAuthDisabled ? MockUseAuth : ClerkUseAuth;

// Export the appropriate components based on auth status
export const SignedIn = isAuthDisabled ? MockSignedIn : ClerkSignedIn;
export const SignedOut = isAuthDisabled ? MockSignedOut : ClerkSignedOut;
// Use Clerk's SignInButton directly - it should handle custom children
export const SignInButton = isAuthDisabled ? MockSignInButton : ClerkSignInButton;
export const SignUpButton = isAuthDisabled ? MockSignInButton : ClerkSignUpButton;
export const UserButton = isAuthDisabled ? MockUserButton : ClerkUserButton;

// Wrapper component that handles SSR/hydration issues
export function SignInButtonWrapper({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  // Use the SignInButton component directly - Clerk handles SSR properly
  const ButtonComponent = isAuthDisabled ? MockSignInButton : ClerkSignInButton;
  return <ButtonComponent {...props}>{children}</ButtonComponent>;
}

// Wrapper for SignedOut that ensures content is visible during SSR
export function SignedOutWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, always show the content
  // This ensures the Sign In button is visible on page load
  if (!mounted || !isLoaded) {
    return <>{children}</>;
  }

  // After mount and auth is loaded, only show if signed out
  if (isSignedIn === false) {
    return <>{children}</>;
  }

  return null;
}

// Wrapper for SignedIn that handles SSR properly
export function SignedInWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, don't show signed-in content
  if (!mounted || !isLoaded) {
    return null;
  }

  // After mount and auth is loaded, only show if signed in
  if (isSignedIn === true) {
    return <>{children}</>;
  }

  return null;
}

// Wrapper for UserButton that handles SSR properly
export function UserButtonWrapper(props: Record<string, unknown>) {
  const [mounted, setMounted] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();
  const ButtonComponent = isAuthDisabled ? MockUserButton : ClerkUserButton;

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, don't show the user button
  if (!mounted || !isLoaded) {
    return null;
  }

  // After mount and auth is loaded, only show if signed in
  if (isSignedIn === true) {
    return <ButtonComponent {...props} />;
  }

  return null;
}
