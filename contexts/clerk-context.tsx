"use client";

/**
 * Clerk Availability Context
 *
 * This context provides a React-safe way to determine if ClerkProvider
 * is available in the component tree, replacing the problematic global
 * window flag approach.
 *
 * Usage:
 * - Wrap authenticated routes with ClerkAvailableProvider
 * - Components can use useClerkAvailable() hook to check availability
 * - No race conditions or React context boundary violations
 */

import { createContext, useContext, ReactNode } from 'react';

interface ClerkAvailableContextValue {
  isAvailable: boolean;
}

const ClerkAvailableContext = createContext<ClerkAvailableContextValue>({
  isAvailable: false,
});

/**
 * Provider component that marks a section of the component tree
 * as having ClerkProvider available.
 *
 * Should be placed INSIDE ClerkProvider wrapper in authenticated layout.
 */
export function ClerkAvailableProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkAvailableContext.Provider value={{ isAvailable: true }}>
      {children}
    </ClerkAvailableContext.Provider>
  );
}

/**
 * Hook to check if ClerkProvider is available in the current context.
 *
 * Returns:
 * - isAvailable: true if within ClerkProvider tree, false otherwise
 * - mounted: true after client-side hydration (for SSR safety)
 *
 * @example
 * const { isAvailable, mounted } = useClerkAvailable();
 * if (!mounted) return null; // SSR safety
 * if (!isAvailable) return <FallbackComponent />;
 * return <ClerkComponent />;
 */
export function useClerkAvailable() {
  const context = useContext(ClerkAvailableContext);
  return {
    isAvailable: context.isAvailable,
    mounted: true, // Since this is a client component, we're always mounted when this runs
  };
}
