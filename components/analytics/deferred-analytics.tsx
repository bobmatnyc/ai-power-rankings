"use client";

import dynamic from "next/dynamic";

/**
 * Lighthouse Performance: Defer analytics to reduce main-thread work
 * These components are loaded after hydration to avoid blocking the main thread
 */

const Analytics = dynamic(
  () => import("@vercel/analytics/react").then((m) => ({ default: m.Analytics })),
  { ssr: false }
);

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((m) => ({ default: m.SpeedInsights })),
  { ssr: false }
);

export function DeferredAnalytics() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
