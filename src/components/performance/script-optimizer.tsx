'use client';

import Script from 'next/script';
import { useEffect } from 'react';

interface OptimizedScriptProps {
  src: string;
  strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker';
  priority?: 'high' | 'low';
  defer?: boolean;
  async?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  children?: string;
}

/**
 * Optimized Script component that minimizes main-thread blocking
 */
export function OptimizedScript({
  src,
  strategy = 'lazyOnload',
  priority: _priority = 'low',
  defer = true,
  async = false,
  onLoad,
  onError,
  children,
}: OptimizedScriptProps) {
  return (
    <Script
      id={`optimized-script-${src.replace(/[^a-zA-Z0-9]/g, '-')}`}
      src={src}
      strategy={strategy}
      defer={defer}
      async={async}
      onLoad={onLoad}
      onError={onError}
    >
      {children}
    </Script>
  );
}

/**
 * Component to optimize third-party script loading
 */
export function ThirdPartyScriptOptimizer() {
  useEffect(() => {
    // Optimize Google Tag Manager
    const optimizeGTM = () => {
      // Add timeout to GTM loading to prevent blocking
      const gtmScripts = document.querySelectorAll('script[src*="googletagmanager"]');
      gtmScripts.forEach((script) => {
        if (script instanceof HTMLScriptElement) {
          script.defer = true;
          // Add error handling
          script.onerror = () => {
            console.warn('Failed to load Google Tag Manager');
          };
        }
      });
    };

    // Lazy load non-critical scripts after user interaction
    const lazyLoadScripts = () => {
      let userInteracted = false;

      const loadDeferredScripts = () => {
        if (userInteracted) {
          return;
        }
        userInteracted = true;

        // Load analytics scripts after interaction
        const deferredScripts = document.querySelectorAll('script[data-defer]');
        deferredScripts.forEach((script) => {
          if (script instanceof HTMLScriptElement && script.dataset['defer']) {
            const newScript = document.createElement('script');
            newScript.src = script.dataset['defer'];
            newScript.async = true;
            document.head.appendChild(newScript);
            script.remove();
          }
        });
      };

      // Listen for user interactions
      const events = ['click', 'scroll', 'keydown', 'touchstart'];
      events.forEach((event) => {
        document.addEventListener(event, loadDeferredScripts, {
          once: true,
          passive: true,
        });
      });

      // Fallback: load after 3 seconds if no interaction
      setTimeout(loadDeferredScripts, 3000);
    };

    // Implement script prioritization
    const prioritizeScripts = () => {
      // High priority scripts should load first
      const highPriorityScripts = document.querySelectorAll('script[data-priority="high"]');
      const lowPriorityScripts = document.querySelectorAll('script[data-priority="low"]');

      // Ensure high priority scripts have fetchpriority="high"
      highPriorityScripts.forEach((script) => {
        if (script instanceof HTMLScriptElement) {
          script.setAttribute('fetchpriority', 'high');
        }
      });

      // Defer low priority scripts
      lowPriorityScripts.forEach((script) => {
        if (script instanceof HTMLScriptElement) {
          script['defer'] = true;
          script.setAttribute('fetchpriority', 'low');
        }
      });
    };

    // Apply optimizations
    optimizeGTM();
    lazyLoadScripts();
    prioritizeScripts();

    return () => {
      // Cleanup if needed
    };
  }, []);

  return null;
}

/**
 * Hook to monitor script loading performance
 */
export function useScriptPerformanceMonitoring() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource' && entry.name.includes('.js')) {
          const resourceEntry = entry as PerformanceResourceTiming;

          // Log slow loading scripts
          if (resourceEntry.duration > 1000) {
            console.warn('Slow script detected:', {
              name: entry.name,
              duration: resourceEntry.duration,
              transferSize: resourceEntry.transferSize,
            });
          }

          // Track third-party scripts
          if (entry.name.includes('google') || entry.name.includes('vercel')) {
            console.log('Third-party script loaded:', {
              name: entry.name,
              duration: resourceEntry.duration,
              // renderBlockingStatus may not be available in all browsers
              renderBlockingStatus: (
                resourceEntry as PerformanceResourceTiming & { renderBlockingStatus?: string }
              ).renderBlockingStatus,
            });
          }
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['resource'] });
    } catch {
      console.warn('Performance Observer not supported for resource monitoring');
    }

    return () => observer.disconnect();
  }, []);
}

/**
 * Hook to preload critical JavaScript resources
 */
export function usePreloadCriticalScripts() {
  useEffect(() => {
    const criticalScripts = [
      '/api/rankings/latest',
      // Add other critical resources here
    ];

    criticalScripts.forEach((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'fetch';
      link.href = src;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }, []);
}

/**
 * Component that applies all script optimizations
 */
export function ScriptOptimizer() {
  useScriptPerformanceMonitoring();
  usePreloadCriticalScripts();

  return <ThirdPartyScriptOptimizer />;
}
