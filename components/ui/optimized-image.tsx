"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  fill?: boolean;
  quality?: number;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
}

/**
 * Optimized Image Component for T-031
 *
 * Features:
 * - Automatic WebP format selection
 * - Responsive sizing
 * - Error handling with fallbacks
 * - Loading states
 * - Performance optimizations
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  sizes,
  fill = false,
  quality = 85,
  placeholder = "empty",
  blurDataURL,
  ...props
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Convert PNG to WebP if available
  const getOptimizedSrc = (originalSrc: string) => {
    if (imageError) {
      // Fallback to original if WebP fails
      return originalSrc;
    }

    // Convert crown icon to WebP
    if (originalSrc.includes("crown-of-technology.png")) {
      return "/crown-of-technology.webp";
    }

    // For other PNG images, try WebP version
    if (originalSrc.endsWith(".png")) {
      return originalSrc.replace(".png", ".webp");
    }

    return originalSrc;
  };

  const handleError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  const optimizedSrc = getOptimizedSrc(src);

  return (
    <div className={cn("relative", className)}>
      {isLoading && !priority && (
        <div
          className={cn(
            "absolute inset-0 bg-gray-200 animate-pulse rounded",
            fill ? "w-full h-full" : ""
          )}
          style={!fill ? { width, height } : undefined}
        />
      )}

      <Image
        src={optimizedSrc}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        priority={priority}
        sizes={sizes}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        onError={handleError}
        onLoad={handleLoad}
        {...props}
      />
    </div>
  );
}

/**
 * DEPRECATED: Crown icon components moved to crown-icon-server.tsx
 *
 * DO NOT ADD NEW CROWN ICON COMPONENTS HERE.
 * Use @/components/ui/crown-icon-server instead.
 *
 * Reason: Next.js auto-generates invalid preload tags (imageSrcSet/imageSizes)
 * when <Image> components are used, even with priority=false.
 * This causes HTML validation errors and breaks authentication in production.
 */
