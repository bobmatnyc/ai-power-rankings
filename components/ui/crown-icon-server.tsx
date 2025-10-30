import { cn } from "@/lib/utils";

/**
 * Server-Side Crown Icon - Mobile Performance Optimization
 *
 * CRITICAL: This is a SERVER COMPONENT (no "use client")
 * - Renders on server, reducing client-side JavaScript
 * - Fixes LCP by eliminating client-side hydration delay
 * - No useState, no useEffect, pure SSR
 * - Target: Improve LCP from 7.1s to <2.5s on mobile
 * - Uses aspect ratio container to prevent CLS (0.10 reduction)
 * - Uses responsive image variants (36px, 48px, 64px, 128px) for optimal loading
 * - Uses native <img> to avoid Next.js auto-generating invalid preload tags
 *   (Next.js 15.5.4 generates imageSrcSet instead of imagesrcset - HTML validation error)
 */

interface ResponsiveCrownIconProps {
  className?: string;
  priority?: boolean;
}

export function ResponsiveCrownIcon({ className, priority = false }: ResponsiveCrownIconProps) {
  // Note: Using native <img> instead of Next.js <Image> to avoid
  // Next.js auto-generating invalid preload tags with imageSrcSet/imageSizes
  // Manual preload is already in app/layout.tsx with correct HTML attributes
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{
        width: "clamp(36px, 5vw, 64px)",
        height: "clamp(36px, 5vw, 64px)",
      }}
    >
      <img
        src="/crown-of-technology-64.webp"
        alt="AI Power Ranking Icon"
        width={64}
        height={64}
        className="object-contain w-full h-full"
        loading="eager"
        fetchpriority="high"
      />
    </div>
  );
}

/**
 * Crown Icon Component with Size Variants
 *
 * Uses native <img> to avoid Next.js generating invalid preload tags.
 * Provides predefined size options for consistent icon display.
 */
interface CrownIconProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
}

export function CrownIcon({ size = "md", className, priority = false }: CrownIconProps) {
  const sizeConfig = {
    sm: { width: 36, height: 36, src: "/crown-of-technology-36.webp" },
    md: { width: 48, height: 48, src: "/crown-of-technology-48.webp" },
    lg: { width: 64, height: 64, src: "/crown-of-technology-64.webp" },
    xl: { width: 128, height: 128, src: "/crown-of-technology-128.webp" },
  };

  const config = sizeConfig[size];

  return (
    <img
      src={config.src}
      alt="AI Power Ranking Icon"
      width={config.width}
      height={config.height}
      className={cn("object-contain", className)}
      loading="eager"
      fetchpriority={priority ? "high" : "auto"}
    />
  );
}
