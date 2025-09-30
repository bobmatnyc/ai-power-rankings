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
 * Crown Icon Component - Optimized for T-031
 *
 * Pre-configured component for the crown icon with
 * responsive sizes and WebP optimization.
 */
interface CrownIconProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
}

export function CrownIcon({ size = "md", className, priority = false }: CrownIconProps) {
  const sizeConfig = {
    sm: { width: 24, height: 24, className: "w-6 h-6" },
    md: { width: 48, height: 48, className: "w-12 h-12" },
    lg: { width: 64, height: 64, className: "w-16 h-16" },
    xl: { width: 128, height: 128, className: "w-32 h-32" },
  };

  const config = sizeConfig[size];

  return (
    <OptimizedImage
      src="/crown-of-technology.webp"
      alt="AI Power Ranking Icon"
      width={config.width}
      height={config.height}
      className={cn(config.className, "object-contain", className)}
      priority={priority}
      sizes={`${config.width}px`}
      quality={90}
    />
  );
}

/**
 * Responsive Crown Icon - Optimized for T-031
 *
 * Uses different sizes based on screen size for optimal performance.
 */
interface ResponsiveCrownIconProps {
  className?: string;
  priority?: boolean;
}

export function ResponsiveCrownIcon({ className, priority = false }: ResponsiveCrownIconProps) {
  return (
    <OptimizedImage
      src="/crown-of-technology.webp"
      alt="AI Power Ranking Icon"
      width={64}
      height={64}
      className={cn("w-9 h-9 md:w-12 md:h-12 lg:w-16 lg:h-16 object-contain", className)}
      priority={priority}
      sizes="(max-width: 768px) 36px, (max-width: 1024px) 48px, 64px"
      quality={90}
    />
  );
}
