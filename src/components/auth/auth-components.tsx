"use client";

import {
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  SignInButton as ClerkSignInButton,
  UserButton as ClerkUserButton,
  useAuth,
} from "@clerk/nextjs";
import type React from "react";
import { useEffect, useState } from "react";
// import { SignInButtonCustom } from "./sign-in-button-custom"; // Removed - component no longer used
import {
  SignedIn as MockSignedIn,
  SignedOut as MockSignedOut,
  SignInButton as MockSignInButton,
  UserButton as MockUserButton,
} from "./no-auth-provider";

// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

// Export the appropriate components based on auth status
export const SignedIn = isAuthDisabled ? MockSignedIn : ClerkSignedIn;
export const SignedOut = isAuthDisabled ? MockSignedOut : ClerkSignedOut;
// Use Clerk's SignInButton directly - it should handle custom children
export const SignInButton = isAuthDisabled ? MockSignInButton : ClerkSignInButton;
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

// Helper component for when Clerk is enabled
function ClerkSignedOutWrapper({ children }: { children: React.ReactNode }) {
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

// Wrapper for SignedOut that ensures content is visible during SSR
export function SignedOutWrapper({ children }: { children: React.ReactNode }) {
  // If auth is disabled, use mock component
  if (isAuthDisabled) {
    return <MockSignedOut>{children}</MockSignedOut>;
  }

  // Use the Clerk-aware wrapper
  return <ClerkSignedOutWrapper>{children}</ClerkSignedOutWrapper>;
}

// Helper component for when Clerk is enabled
function ClerkSignedInWrapper({ children }: { children: React.ReactNode }) {
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

// Wrapper for SignedIn that handles SSR properly
export function SignedInWrapper({ children }: { children: React.ReactNode }) {
  // If auth is disabled, use mock component
  if (isAuthDisabled) {
    return <MockSignedIn>{children}</MockSignedIn>;
  }

  // Use the Clerk-aware wrapper
  return <ClerkSignedInWrapper>{children}</ClerkSignedInWrapper>;
}

// Helper component for when Clerk is enabled
function ClerkUserButtonWrapper(props: Record<string, unknown>) {
  const [mounted, setMounted] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, don't show the user button
  if (!mounted || !isLoaded) {
    return null;
  }

  // After mount and auth is loaded, only show if signed in
  if (isSignedIn === true) {
    return <ClerkUserButton {...props} />;
  }

  return null;
}

// Helper component for mock UserButton
function MockUserButtonWrapper(props: Record<string, unknown>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <MockUserButton {...props} />;
}

// Wrapper for UserButton that handles SSR properly
export function UserButtonWrapper(props: Record<string, unknown>) {
  // If auth is disabled, use mock component
  if (isAuthDisabled) {
    return <MockUserButtonWrapper {...props} />;
  }

  // Use the Clerk-aware wrapper
  return <ClerkUserButtonWrapper {...props} />;
}
