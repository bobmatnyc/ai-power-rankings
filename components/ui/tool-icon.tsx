"use client";

import { Newspaper } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ToolIconProps {
  name: string;
  domain?: string;
  size?: number;
  className?: string;
  context?: "news" | "default";
}

export function ToolIcon({
  name,
  domain,
  size = 48,
  className,
  context = "default",
}: ToolIconProps) {
  const [imageError, setImageError] = useState(false);

  // Detect if this is a local path (starts with '/')
  const isLocalPath = domain?.startsWith('/');

  // Debug log to understand what's happening
  if (process.env["NODE_ENV"] === "development") {
    console.log("ToolIcon:", { name, domain, isLocalPath, imageError });
  }

  // Generate a consistent color based on the tool name
  const getGradientClass = (name: string) => {
    const colors = [
      "bg-gradient-to-br from-blue-500 to-blue-600",
      "bg-gradient-to-br from-purple-500 to-purple-600",
      "bg-gradient-to-br from-green-500 to-green-600",
      "bg-gradient-to-br from-orange-500 to-orange-600",
      "bg-gradient-to-br from-pink-500 to-pink-600",
      "bg-gradient-to-br from-indigo-500 to-indigo-600",
      "bg-gradient-to-br from-teal-500 to-teal-600",
      "bg-gradient-to-br from-red-500 to-red-600",
    ];

    // Simple hash function to get consistent color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash = hash & hash;
    }

    return colors[Math.abs(hash) % colors.length];
  };

  // News icon fallback for news context
  const NewsIcon = () => (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg",
        "bg-gradient-to-br from-gray-500 to-gray-600",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Newspaper size={size * 0.6} className="text-white" />
    </div>
  );

  // Generic tool icon fallback
  const GenericToolIcon = () => (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border-2 border-border",
        getGradientClass(name),
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-white"
        aria-label={`${name} icon`}
      >
        <title>{name}</title>
        <path
          d="M12 2L13.09 5.26L16 2L14.21 5.63L18 3L15.5 6.5L20 4L16.5 8.5L22 6L17.5 11.5L22 10L17 14L22 13L16 17L20 16L14.5 19.5L18 18L13.09 21.74L16 22L12 22L10.91 18.74L8 22L9.79 18.37L6 21L8.5 17.5L4 20L7.5 15.5L2 18L6.5 12.5L2 14L7 10L2 11L8 7L4 8L9.5 4.5L6 6L10.91 2.26L8 2L12 2Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );

  if (!domain || imageError) {
    return context === "news" ? <NewsIcon /> : <GenericToolIcon />;
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Image
        src={isLocalPath
          ? domain  // Use local path directly
          : `/api/favicon?domain=${encodeURIComponent(domain)}&size=${size}`
        }
        alt={`${name} icon`}
        width={size}
        height={size}
        className={cn("rounded-lg", className)}
        onError={() => setImageError(true)}
        quality={85}
        unoptimized={isLocalPath}  // Don't optimize local PNGs, they're already optimized
      />
    </div>
  );
}
