/**
 * SSR-safe utility functions for browser APIs
 * Prevents hydration errors by ensuring consistent behavior between server and client
 */

/**
 * Check if we're running in a browser environment
 */
export const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";

/**
 * SSR-safe window access
 */
export const safeWindow = isBrowser ? window : undefined;

/**
 * SSR-safe document access
 */
export const safeDocument = isBrowser ? document : undefined;

/**
 * SSR-safe localStorage access
 */
export const safeLocalStorage = isBrowser ? localStorage : undefined;

/**
 * SSR-safe sessionStorage access
 */
export const safeSessionStorage = isBrowser ? sessionStorage : undefined;

/**
 * Get viewport dimensions safely
 */
export function getViewportDimensions() {
  if (!isBrowser) {
    // Return default dimensions for SSR
    return { width: 1024, height: 768 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Check if media query matches (SSR-safe)
 */
export function matchesMediaQuery(query: string, defaultValue = false): boolean {
  if (!isBrowser) {
    return defaultValue;
  }
  return window.matchMedia(query).matches;
}

/**
 * SSR-safe className generator for responsive text
 * Ensures consistent rendering between server and client
 */
export function getResponsiveTextClass(
  baseClass: string,
  options?: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
  }
): string {
  // Always return the same classes on both server and client
  // Use responsive Tailwind classes instead of JavaScript detection
  let classes = baseClass;

  if (options?.sm) classes += ` sm:${options.sm}`;
  if (options?.md) classes += ` md:${options.md}`;
  if (options?.lg) classes += ` lg:${options.lg}`;
  if (options?.xl) classes += ` xl:${options.xl}`;

  return classes;
}