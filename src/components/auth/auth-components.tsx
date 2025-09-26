"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
// Import mock components that are always safe
import {
  SignedIn as MockSignedIn,
  SignedOut as MockSignedOut,
  SignInButton as MockSignInButton,
  useAuth as MockUseAuth,
  UserButton as MockUserButton,
} from "./no-auth-provider";
import { UserButtonWithAdmin } from "./user-button-with-admin";

// Initialize Clerk components at module level to preserve context
type ClerkComponent = React.ComponentType<{ children?: React.ReactNode; [key: string]: unknown }>;
type ClerkHook = () => Record<string, unknown>;

// Store clerk components in a ref to prevent re-loading
const clerkComponentsCache: {
  SignedIn: ClerkComponent | null;
  SignedOut: ClerkComponent | null;
  SignInButton: ClerkComponent | null;
  SignUpButton: ClerkComponent | null;
  useAuth: ClerkHook | null;
  UserButton: ClerkComponent | null;
  loaded: boolean;
  error: Error | null;
  loadPromise: Promise<void> | null;
} = {
  SignedIn: null,
  SignedOut: null,
  SignInButton: null,
  SignUpButton: null,
  useAuth: null,
  UserButton: null,
  loaded: false,
  error: null,
  loadPromise: null,
};

// Load Clerk components dynamically with async import to prevent useContext errors
async function loadClerkComponents(): Promise<typeof clerkComponentsCache> {
  if (clerkComponentsCache.loaded) {
    return clerkComponentsCache;
  }

  // If already loading, wait for the existing promise
  if (clerkComponentsCache.loadPromise) {
    await clerkComponentsCache.loadPromise;
    return clerkComponentsCache;
  }

  // Only attempt to load Clerk on the client side
  if (typeof window === "undefined") {
    clerkComponentsCache.loaded = true;
    return clerkComponentsCache;
  }

  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  if (isAuthDisabled || !hasClerkKey) {
    clerkComponentsCache.loaded = true;
    return clerkComponentsCache;
  }

  // Create a single loading promise to prevent multiple imports
  clerkComponentsCache.loadPromise = (async () => {
    try {
      // Use async dynamic import to prevent useContext errors
      const clerkModule = await import("@clerk/nextjs");

      if (clerkModule) {
        clerkComponentsCache.SignedIn = clerkModule.SignedIn;
        clerkComponentsCache.SignedOut = clerkModule.SignedOut;
        clerkComponentsCache.SignInButton = clerkModule.SignInButton;
        clerkComponentsCache.SignUpButton = clerkModule.SignUpButton;
        clerkComponentsCache.useAuth = clerkModule.useAuth;
        clerkComponentsCache.UserButton = clerkModule.UserButton;
        clerkComponentsCache.loaded = true;
        console.info("[AuthComponents] Clerk components loaded successfully");
      }
    } catch (error) {
      console.warn("[AuthComponents] Clerk module not available:", error);
      clerkComponentsCache.error = error as Error;
      clerkComponentsCache.loaded = true; // Mark as loaded even on error to prevent retries
    }
  })();

  await clerkComponentsCache.loadPromise;
  return clerkComponentsCache;
}

// Check auth configuration
const getIsAuthDisabled = () => {
  return process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
};

// Create a wrapper that dynamically chooses the right implementation
// This ensures we never call hooks conditionally
export const useAuth = () => {
  // Always initialize with mock result - React hooks must be called consistently
  const mockResult = MockUseAuth();
  const [useClerkAuth, setUseClerkAuth] = useState(false);

  useEffect(() => {
    // Only attempt Clerk loading on client side
    if (typeof window === "undefined") {
      return;
    }

    const isAuthDisabled = getIsAuthDisabled();
    const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

    if (isAuthDisabled || !hasClerkKey) {
      return;
    }

    // Async load Clerk components
    loadClerkComponents()
      .then((components) => {
        if (components.useAuth && !components.error) {
          setUseClerkAuth(true);
        }
      })
      .catch((error) => {
        console.warn("[useAuth] Failed to load Clerk components:", error);
      });
  }, []);

  // Create a ref to hold the Clerk useAuth hook instance
  const clerkAuthRef = useRef<ClerkHook | null>(null);

  // Initialize Clerk's useAuth hook only when it becomes available
  useEffect(() => {
    if (!useClerkAuth || typeof window === "undefined") {
      return;
    }

    const components = clerkComponentsCache;
    if (components.useAuth && components.loaded && !components.error) {
      clerkAuthRef.current = components.useAuth;
    }
  }, [useClerkAuth]);

  // Call Clerk's useAuth hook only if it's available, otherwise use mock
  let clerkAuthResult: Record<string, unknown> | null = null;
  if (clerkAuthRef.current && useClerkAuth) {
    try {
      clerkAuthResult = clerkAuthRef.current();
    } catch (error) {
      console.warn("[useAuth] Clerk useAuth failed:", error);
      clerkAuthResult = null;
    }
  }

  // Return Clerk auth if available and loaded, otherwise mock
  return clerkAuthResult && useClerkAuth ? clerkAuthResult : mockResult;
};

// Create a safe wrapper that handles optional children
const SafeComponentWrapper = ({
  component: Component,
  children,
  ...props
}: {
  component: ClerkComponent | null;
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  if (!Component) {
    return null;
  }

  // Safely pass children and props, handling cases where the component expects optional children
  return <Component {...props}>{children}</Component>;
};

// Export wrapper components that choose implementation at runtime with async loading
export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const [Component, setComponent] = useState<ClerkComponent | null>(null);

  useEffect(() => {
    const isAuthDisabled = getIsAuthDisabled();
    if (isAuthDisabled) {
      setComponent(() => MockSignedIn as ClerkComponent);
      return;
    }

    loadClerkComponents()
      .then((components) => {
        if (components.SignedIn && !components.error) {
          setComponent(() => components.SignedIn);
        } else {
          setComponent(() => MockSignedIn as ClerkComponent);
        }
      })
      .catch(() => {
        setComponent(() => MockSignedIn as ClerkComponent);
      });
  }, []);

  return <SafeComponentWrapper component={Component}>{children}</SafeComponentWrapper>;
};

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  const [Component, setComponent] = useState<ClerkComponent | null>(null);

  useEffect(() => {
    const isAuthDisabled = getIsAuthDisabled();
    if (isAuthDisabled) {
      setComponent(() => MockSignedOut as ClerkComponent);
      return;
    }

    loadClerkComponents()
      .then((components) => {
        if (components.SignedOut && !components.error) {
          setComponent(() => components.SignedOut);
        } else {
          setComponent(() => MockSignedOut as ClerkComponent);
        }
      })
      .catch(() => {
        setComponent(() => MockSignedOut as ClerkComponent);
      });
  }, []);

  return <SafeComponentWrapper component={Component}>{children}</SafeComponentWrapper>;
};

export const SignInButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  const [Component, setComponent] = useState<ClerkComponent | null>(null);

  useEffect(() => {
    const isAuthDisabled = getIsAuthDisabled();
    if (isAuthDisabled) {
      setComponent(() => MockSignInButton as ClerkComponent);
      return;
    }

    loadClerkComponents()
      .then((components) => {
        if (components.SignInButton && !components.error) {
          setComponent(() => components.SignInButton);
        } else {
          setComponent(() => MockSignInButton as ClerkComponent);
        }
      })
      .catch(() => {
        setComponent(() => MockSignInButton as ClerkComponent);
      });
  }, []);

  return (
    <SafeComponentWrapper component={Component} {...props}>
      {children}
    </SafeComponentWrapper>
  );
};

export const SignUpButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  const [Component, setComponent] = useState<ClerkComponent | null>(null);

  useEffect(() => {
    const isAuthDisabled = getIsAuthDisabled();
    if (isAuthDisabled) {
      setComponent(() => MockSignInButton as ClerkComponent);
      return;
    }

    loadClerkComponents()
      .then((components) => {
        if (components.SignUpButton && !components.error) {
          setComponent(() => components.SignUpButton);
        } else {
          setComponent(() => MockSignInButton as ClerkComponent);
        }
      })
      .catch(() => {
        setComponent(() => MockSignInButton as ClerkComponent);
      });
  }, []);

  return (
    <SafeComponentWrapper component={Component} {...props}>
      {children}
    </SafeComponentWrapper>
  );
};

export const UserButton = (props: Record<string, unknown>) => {
  const [Component, setComponent] = useState<ClerkComponent | null>(null);

  useEffect(() => {
    const isAuthDisabled = getIsAuthDisabled();
    if (isAuthDisabled) {
      setComponent(() => MockUserButton as ClerkComponent);
      return;
    }

    loadClerkComponents()
      .then((components) => {
        if (components.UserButton && !components.error) {
          setComponent(() => components.UserButton);
        } else {
          setComponent(() => MockUserButton as ClerkComponent);
        }
      })
      .catch(() => {
        setComponent(() => MockUserButton as ClerkComponent);
      });
  }, []);

  return <SafeComponentWrapper component={Component} {...props} />;
};

// Wrapper component that handles SSR/hydration issues
export function SignInButtonWrapper({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  return <SignInButton {...props}>{children}</SignInButton>;
}

// Wrapper for SignedOut that ensures content is visible during SSR
export function SignedOutWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Always call hooks at the top level - never conditionally
  const authData = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, always show the content
  // This ensures the Sign In button is visible on page load
  if (!mounted || !authData.isLoaded) {
    return <>{children}</>;
  }

  // After mount and auth is loaded, only show if signed out
  if (authData.isSignedIn === false) {
    return <>{children}</>;
  }

  return null;
}

// Wrapper for SignedIn that handles SSR properly
export function SignedInWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Always call hooks at the top level - never conditionally
  const authData = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, don't show signed-in content
  if (!mounted || !authData.isLoaded) {
    return null;
  }

  // After mount and auth is loaded, only show if signed in
  if (authData.isSignedIn === true) {
    return <>{children}</>;
  }

  return null;
}

// Wrapper for UserButton that handles SSR properly
export function UserButtonWrapper(props: Record<string, unknown>) {
  const [mounted, setMounted] = useState(false);
  // Always call hooks at the top level - never conditionally
  const authData = useAuth();
  const isAuthDisabled = getIsAuthDisabled();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, don't show the user button
  if (!mounted || !authData.isLoaded) {
    return null;
  }

  // After mount and auth is loaded, only show if signed in
  if (authData.isSignedIn === true) {
    // Use UserButtonWithAdmin for Clerk auth, MockUserButton for disabled auth
    const ButtonComponent = isAuthDisabled ? MockUserButton : UserButtonWithAdmin;
    return <ButtonComponent {...props} />;
  }

  return null;
}
