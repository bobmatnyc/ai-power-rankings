"use client";

import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Type definitions for the NoAuth context
interface NoAuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: null;
  session: null;
  signOut: () => Promise<void>;
}

// Create contexts that mimic Clerk's structure with proper SSR handling
const NoAuthContext = createContext<NoAuthContextType | null>(null);

interface NoAuthProviderProps {
  children: ReactNode;
}

export function NoAuthProvider({ children }: NoAuthProviderProps) {
  const [isSignedIn, setIsSignedIn] = useState(true); // Default to signed in for dev mode

  const signOut = useCallback(async () => {
    console.log("Sign out called in development mode");
    setIsSignedIn(false);
  }, []);

  const value: NoAuthContextType = {
    isLoaded: true,
    isSignedIn,
    user: null,
    session: null,
    signOut,
  };

  // Ensure children is always defined
  const safeChildren = children ?? null;

  return <NoAuthContext.Provider value={value}>{safeChildren}</NoAuthContext.Provider>;
}

// Helper function to get context with proper null checks
export function useNoAuthContext(): NoAuthContextType | null {
  const context = useContext(NoAuthContext);
  return context;
}

// Export hooks that mimic Clerk's API with proper error handling
export function useAuth() {
  const context = useNoAuthContext();

  // If not inside a NoAuthProvider, return a default mock state
  // This happens when Clerk fails to load and we haven't wrapped with NoAuthProvider
  if (!context) {
    return {
      isLoaded: true,
      isSignedIn: false,
      userId: null,
      sessionId: null,
      signOut: async () => {
        console.log("Sign out called but no auth provider available");
      },
      getToken: async () => null,
      has: () => false,
    };
  }

  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    userId: null, // Always null when not signed in
    sessionId: null, // Always null when not signed in
    signOut: context.signOut,
    getToken: async () => null, // Return null when not signed in
    has: () => false, // Return false when not signed in
  };
}

export function useUser() {
  const context = useNoAuthContext();

  if (!context) {
    return {
      isLoaded: true,
      isSignedIn: false,
      user: null,
    };
  }

  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    user: context.user || null,
  };
}

export function useClerk() {
  const context = useNoAuthContext();

  if (!context) {
    return {
      loaded: true,
      session: null,
      user: null,
      signOut: async () => {
        console.log("Sign out called but no auth provider available");
      },
    };
  }

  return {
    loaded: context.isLoaded,
    session: context.session,
    user: context.user,
    signOut: context.signOut,
  };
}

export function useSession() {
  const context = useNoAuthContext();

  if (!context) {
    return {
      isLoaded: true,
      isSignedIn: false,
      session: null,
    };
  }

  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    session: context.session,
  };
}

// Mock SignedIn and SignedOut components for development mode
export function SignedIn({ children }: { children: ReactNode }) {
  const context = useNoAuthContext();
  const safeChildren = children ?? null;

  // If no context, assume signed out
  if (!context) {
    return null;
  }
  // Only render children if signed in
  return context.isSignedIn ? <>{safeChildren}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const context = useNoAuthContext();
  const safeChildren = children ?? null;

  // If no context, assume signed out
  if (!context) {
    return <>{safeChildren}</>;
  }
  // Only render children if signed out
  return !context.isSignedIn ? <>{safeChildren}</> : null;
}

// Mock SignInButton component
export function SignInButton({ children }: { children: ReactNode }) {
  const handleClick = () => {
    // In development mode, just log the action
    console.log("SignInButton clicked (development mode)");
    console.log("Would redirect to: /sign-in");
  };

  // If children is a React element, clone it with onClick
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: handleClick,
    });
  }

  // Otherwise wrap in a button
  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}

// Mock UserButton component with admin link for development
export function UserButton({ afterSignOutUrl }: { afterSignOutUrl?: string }) {
  const context = useNoAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract language from afterSignOutUrl or default to 'en'
  const lang = afterSignOutUrl ? afterSignOutUrl.split("/")[1] || "en" : "en";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // If no context or not signed in, don't render
  if (!context || !context.isSignedIn) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center hover:bg-gray-400 transition-colors"
      >
        <span className="text-xs">DU</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700 border-b">Dev User</div>
            <a
              href={`/${lang}/admin`}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <title>Admin Dashboard Icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Admin Dashboard
            </a>
            <button
              type="button"
              onClick={() => {
                context.signOut();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
