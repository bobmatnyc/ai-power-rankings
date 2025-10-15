import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Server-Side Crown Icon - Mobile Performance Optimization
 *
 * CRITICAL: This is a SERVER COMPONENT (no "use client")
 * - Renders on server, reducing client-side JavaScript
 * - Fixes LCP by eliminating client-side hydration delay
 * - No useState, no useEffect, pure SSR
 * - Target: Improve LCP from 7.1s to <2.5s on mobile
 */

interface ResponsiveCrownIconProps {
  className?: string;
  priority?: boolean;
}

export function ResponsiveCrownIcon({ className, priority = false }: ResponsiveCrownIconProps) {
  return (
    <Image
      src="/crown-of-technology.webp"
      alt="AI Power Ranking Icon"
      width={64}
      height={64}
      className={cn("w-9 h-9 md:w-12 md:h-12 lg:w-16 lg:h-16 object-contain", className)}
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
      sizes="(max-width: 768px) 36px, (max-width: 1024px) 48px, 64px"
      quality={90}
    />
  );
}
