"use client";

import React, { createContext, type ReactNode, useContext } from "react";

// Type definitions for the NoAuth context
interface NoAuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: null;
  session: null;
  signOut: () => Promise<void>;
}

// Create contexts that mimic Clerk's structure
const NoAuthContext = createContext<NoAuthContextType>({
  isLoaded: true,
  isSignedIn: false, // Simulate signed-out state
  user: null,
  session: null,
  signOut: async () => {
    console.log("Sign out called in development mode");
  },
});

interface NoAuthProviderProps {
  children: ReactNode;
}

export function NoAuthProvider({ children }: NoAuthProviderProps) {
  const value = {
    isLoaded: true,
    isSignedIn: false, // Changed to false to simulate signed-out state
    user: null,
    session: null,
    signOut: async () => {
      console.log("Sign out called in development mode");
    },
  };

  return <NoAuthContext.Provider value={value}>{children}</NoAuthContext.Provider>;
}

// Export hooks that mimic Clerk's API
export function useAuth() {
  const context = useContext(NoAuthContext);
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
  const context = useContext(NoAuthContext);
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    user: context.user || null,
  };
}

export function useClerk() {
  const context = useContext(NoAuthContext);
  return {
    loaded: context.isLoaded,
    session: context.session,
    user: context.user,
    signOut: context.signOut,
  };
}

export function useSession() {
  const context = useContext(NoAuthContext);
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    session: context.session,
  };
}

// Mock SignedIn and SignedOut components for development mode
export function SignedIn({ children }: { children: ReactNode }) {
  const context = useContext(NoAuthContext);
  // Only render children if signed in
  return context.isSignedIn ? children : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const context = useContext(NoAuthContext);
  // Only render children if signed out
  return !context.isSignedIn ? children : null;
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

// Mock UserButton component
export function UserButton() {
  const context = useContext(NoAuthContext);
  if (!context.isSignedIn) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
        <span className="text-xs">DU</span>
      </div>
    </div>
  );
}
