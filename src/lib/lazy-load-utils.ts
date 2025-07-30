/**
 * Utility functions for optimized lazy loading and code splitting.
 * 
 * WHY: These utilities help reduce initial bundle size and improve performance
 * by loading components only when they're needed or likely to be needed soon.
 * 
 * DESIGN DECISIONS:
 * - Intersection Observer for viewport-based loading
 * - Idle callback for low-priority components
 * - Prefetch on hover for anticipated interactions
 * - Resource hints for critical third-party resources
 */

/**
 * Load a component when it enters the viewport.
 * 
 * @param elementId - ID of the element to observe
 * @param loadCallback - Function to call when element is visible
 * @param rootMargin - Margin around viewport to trigger loading early
 */
export function loadOnVisible(
  elementId: string,
  loadCallback: () => void,
  rootMargin = "50px"
): void {
  if (typeof window === "undefined") return;

  const element = document.getElementById(elementId);
  if (!element) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadCallback();
          observer.disconnect();
        }
      });
    },
    { rootMargin }
  );

  observer.observe(element);
}

/**
 * Load a component when the browser is idle.
 * 
 * @param loadCallback - Function to call when browser is idle
 * @param timeout - Maximum time to wait before loading (ms)
 */
export function loadOnIdle(loadCallback: () => void, timeout = 2000): void {
  if (typeof window === "undefined") return;

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadCallback, { timeout });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(loadCallback, timeout);
  }
}

/**
 * Prefetch a dynamic import on hover/focus for faster loading.
 * 
 * @param elementId - ID of the element to attach listeners to
 * @param importFn - Dynamic import function to prefetch
 */
export function prefetchOnHover(
  elementId: string,
  importFn: () => Promise<any>
): void {
  if (typeof window === "undefined") return;

  const element = document.getElementById(elementId);
  if (!element) return;

  let prefetched = false;

  const prefetch = () => {
    if (!prefetched) {
      prefetched = true;
      importFn();
    }
  };

  element.addEventListener("mouseenter", prefetch, { once: true });
  element.addEventListener("focus", prefetch, { once: true });
}

/**
 * Add resource hints for third-party resources.
 * 
 * @param urls - Array of URLs to add hints for
 * @param rel - Relationship type (preconnect, dns-prefetch, prefetch)
 */
export function addResourceHints(
  urls: string[],
  rel: "preconnect" | "dns-prefetch" | "prefetch"
): void {
  if (typeof window === "undefined") return;

  urls.forEach((url) => {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = url;
    
    if (rel === "preconnect") {
      link.crossOrigin = "anonymous";
    }
    
    document.head.appendChild(link);
  });
}

/**
 * Detect if the user is on a slow connection.
 * 
 * @returns true if connection is slow or save-data is enabled
 */
export function isSlowConnection(): boolean {
  if (typeof window === "undefined") return false;

  // Check for Save-Data header
  if ("connection" in navigator) {
    const connection = (navigator as any).connection;
    
    if (connection.saveData) return true;
    
    // Check effective connection type
    const slowConnections = ["slow-2g", "2g"];
    if (slowConnections.includes(connection.effectiveType)) return true;
    
    // Check round-trip time (RTT)
    if (connection.rtt > 500) return true;
    
    // Check downlink speed (less than 1 Mbps)
    if (connection.downlink < 1) return true;
  }

  return false;
}

/**
 * Progressive enhancement wrapper that loads enhanced features
 * only on capable devices and connections.
 * 
 * @param basicComponent - Basic component to show initially
 * @param options - Loading options
 */
export function progressiveEnhancement(
  basicComponent: React.ReactElement,
  options: {
    onSlow?: boolean;
  } = {}
): React.ReactElement {
  const { onSlow = false } = options;

  // Skip enhancement on slow connections unless explicitly allowed
  if (!onSlow && isSlowConnection()) {
    return basicComponent;
  }

  // Return basic component - enhancement will be handled by the component itself
  return basicComponent;
}

/**
 * Create a performance-optimized dynamic import with retry logic.
 * 
 * @param importFn - Dynamic import function
 * @param retries - Number of retry attempts
 * @param delay - Delay between retries (ms)
 */
export async function resilientImport<T>(
  importFn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await importFn();
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return resilientImport(importFn, retries - 1, delay * 2);
    }
    throw error;
  }
}