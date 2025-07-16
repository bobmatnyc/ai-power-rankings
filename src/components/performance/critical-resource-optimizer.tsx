"use client";

import { useEffect } from "react";

/**
 * Critical Resource Optimizer Component
 * Implements performance optimizations to reduce main-thread blocking
 * and improve Core Web Vitals, specifically targeting LCP and CLS
 */
export function CriticalResourceOptimizer() {
  useEffect(() => {
    // Optimize critical request chains
    const optimizeCriticalChains = () => {
      // Preload critical API endpoints
      const criticalEndpoints = ["/api/rankings/latest", "/data/rankings.json"];

      criticalEndpoints.forEach((endpoint) => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = endpoint;
        document.head.appendChild(link);
      });
    };

    // Reduce main-thread blocking tasks
    const optimizeMainThread = () => {
      // Use requestIdleCallback for non-critical operations
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(
          () => {
            // Defer non-critical image loading
            const images = document.querySelectorAll("img[data-defer]");
            images.forEach((img) => {
              if (img instanceof HTMLImageElement && img.dataset.defer) {
                img.src = img.dataset.defer;
                img.removeAttribute("data-defer");
              }
            });
          },
          { timeout: 1000 }
        );
      }
    };

    // Optimize font loading to prevent layout shifts
    const optimizeFontLoading = () => {
      // Ensure font-display: swap is working
      const fontFaces = document.fonts;
      if (fontFaces) {
        fontFaces.ready.then(() => {
          // Font loaded, prevent future layout shifts
          document.documentElement.classList.add("fonts-loaded");
        });
      }
    };

    // Optimize third-party script impact
    const optimizeThirdPartyScripts = () => {
      // Defer Google Tag Manager to reduce main-thread blocking
      const gtmScripts = document.querySelectorAll('script[src*="googletagmanager"]');
      gtmScripts.forEach((script) => {
        if (script instanceof HTMLScriptElement) {
          script.defer = true;
        }
      });
    };

    // Execute optimizations
    optimizeCriticalChains();
    optimizeMainThread();
    optimizeFontLoading();
    optimizeThirdPartyScripts();

    // Intersection Observer for progressive image loading
    const imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute("data-src");
              imageObserver.unobserve(img);
            }
          }
        });
      },
      { rootMargin: "50px" }
    );

    // Observe all images with data-src attribute
    const lazyImages = document.querySelectorAll("img[data-src]");
    lazyImages.forEach((img) => imageObserver.observe(img));

    // Cleanup function
    return () => {
      imageObserver.disconnect();
    };
  }, []);

  // Return null as this is a utility component
  return null;
}

/**
 * Performance monitoring hook for Core Web Vitals
 */
export function usePerformanceMonitoring() {
  useEffect(() => {
    // Monitor performance metrics
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        // Log performance entries for debugging
        if (process.env.NODE_ENV === "development") {
          console.log("Performance:", entry.name, entry.duration);
        }

        // Track long tasks that block the main thread
        if (entry.entryType === "longtask") {
          console.warn("Long task detected:", entry.duration, "ms");
        }
      });
    });

    // Observe different performance metrics
    try {
      observer.observe({ entryTypes: ["navigation", "paint", "longtask", "measure"] });
    } catch {
      // Fallback for older browsers
      console.warn("Performance Observer not fully supported");
    }

    return () => observer.disconnect();
  }, []);
}
