"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";

interface LazySectionProps {
  children: ReactNode;
  fallbackHeight?: string;
  rootMargin?: string;
  className?: string;
}

/**
 * Lighthouse Performance: Lazy load below-the-fold content
 * Reduces initial DOM size and improves rendering performance
 */
export function LazySection({
  children,
  fallbackHeight = "400px",
  rootMargin = "100px",
  className,
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : <div style={{ height: fallbackHeight }} aria-hidden="true" />}
    </div>
  );
}
