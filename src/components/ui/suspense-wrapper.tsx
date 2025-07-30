import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { RankingsTableSkeleton } from "./skeleton";

interface SuspenseWrapperProps {
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Generic Suspense wrapper with error boundary for lazy-loaded components.
 * 
 * WHY: Heavy components block the main thread during initial render.
 * Suspense allows React to render a fallback UI while the component loads,
 * keeping the main thread responsive.
 * 
 * DESIGN DECISION: Provide sensible defaults for common loading states
 * while allowing customization for specific use cases.
 */
export function SuspenseWrapper({ 
  fallback = <RankingsTableSkeleton />, 
  children 
}: SuspenseWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}

/**
 * Higher-order component to wrap a component with Suspense.
 * 
 * WHY: Simplifies adding Suspense boundaries to dynamically imported components
 * and ensures consistent loading states across the app.
 * 
 * @param Component The component to wrap
 * @param fallback Optional custom fallback UI
 * @returns Wrapped component with Suspense
 */
export function withSuspense<P extends object>(
  Component: ComponentType<P>,
  fallback?: ReactNode
): ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <SuspenseWrapper fallback={fallback}>
      <Component {...props} />
    </SuspenseWrapper>
  );
  
  WrappedComponent.displayName = `withSuspense(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Lazy load a component with built-in Suspense and performance tracking.
 * 
 * WHY: Combines lazy loading with performance monitoring to identify
 * components that take too long to load.
 * 
 * @param importFn Dynamic import function
 * @param options Loading options
 * @returns Lazy loaded component with Suspense
 */
export function lazyWithTracking<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    fallback?: ReactNode;
    trackingName?: string;
    preload?: boolean;
  } = {}
) {
  const { fallback, trackingName, preload = false } = options;
  
  // Track import performance
  const trackedImport = () => {
    if (trackingName && typeof window !== 'undefined' && window.performance) {
      performance.mark(`${trackingName}-import-start`);
    }
    
    return importFn().then((module) => {
      if (trackingName && typeof window !== 'undefined' && window.performance) {
        performance.mark(`${trackingName}-import-end`);
        performance.measure(
          `${trackingName}-import`,
          `${trackingName}-import-start`,
          `${trackingName}-import-end`
        );
        
        // Log slow imports in development
        if (process.env.NODE_ENV === 'development') {
          const measures = performance.getEntriesByName(`${trackingName}-import`);
          const measure = measures[measures.length - 1];
          if (measure && measure.duration > 100) {
            console.warn(
              `Slow component import: ${trackingName} took ${measure.duration.toFixed(2)}ms`
            );
          }
        }
      }
      
      return module;
    });
  };
  
  // Create lazy component
  const LazyComponent = lazy(trackedImport);
  
  // Preload on idle if requested
  if (preload && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      trackedImport().catch(() => {
        // Ignore preload errors
      });
    }, { timeout: 5000 });
  }
  
  // Return wrapped component with proper type casting
  return withSuspense(LazyComponent as unknown as T, fallback);
}

/**
 * Resource for Suspense data fetching with caching.
 * 
 * WHY: Enables Suspense for data fetching, allowing React to suspend
 * rendering while data loads, keeping the UI responsive.
 * 
 * @param key Unique key for the resource
 * @param fetcher Function that returns a promise
 * @returns Resource object with read method
 */
export function createResource<T>(
  _key: string,
  fetcher: () => Promise<T>
): {
  read: () => T;
  refresh: () => void;
  preload: () => void;
} {
  let status: 'pending' | 'success' | 'error' = 'pending';
  let result: T;
  let error: any;
  let suspender: Promise<void>;
  
  const load = () => {
    suspender = fetcher()
      .then((data) => {
        status = 'success';
        result = data;
      })
      .catch((err) => {
        status = 'error';
        error = err;
      });
  };
  
  // Start loading immediately
  load();
  
  return {
    read() {
      switch (status) {
        case 'pending':
          throw suspender;
        case 'error':
          throw error;
        case 'success':
          return result;
      }
    },
    
    refresh() {
      status = 'pending';
      load();
    },
    
    preload() {
      if (status === 'pending') {
        // Trigger loading without throwing
        suspender.catch(() => {});
      }
    }
  };
}

// Re-export React's lazy for convenience
export { lazy } from 'react';