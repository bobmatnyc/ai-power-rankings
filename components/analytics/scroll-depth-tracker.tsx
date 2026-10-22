"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pageTypeFromPath, trackEvent } from "@/lib/analytics/track";

// #175: GA4 enhanced measurement already reports a 90% `scroll`; this adds 75%.
const SCROLL_THRESHOLD = 0.75;

/**
 * Sends `scroll_depth` once per page view when the window is scrolled past 75%.
 *
 * Why: #175 needs a 75% depth signal; enhanced measurement only offers 90%.
 * What: Listens to window scroll (rAF-throttled, passive) and fires once,
 *   then detaches. A pathname change counts as a new page view and re-arms it.
 *   Only a real scroll can fire it, matching enhanced measurement's `scroll`.
 * Test: `tests/unit/analytics-events.test.tsx` ("scroll_depth").
 */
export function ScrollDepthTracker(): null {
  const pathname = usePathname();

  useEffect(() => {
    let fired = false;
    let ticking = false;

    const check = (): void => {
      ticking = false;
      if (fired) return;
      const scrollable = document.documentElement.scrollHeight;
      if (scrollable <= 0) return;
      const seen = (window.scrollY + window.innerHeight) / scrollable;
      if (seen >= SCROLL_THRESHOLD) {
        fired = true;
        window.removeEventListener("scroll", onScroll);
        trackEvent("scroll_depth", { percent_scrolled: 75, page_type: pageTypeFromPath(pathname) });
      }
    };

    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(check);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return null;
}
