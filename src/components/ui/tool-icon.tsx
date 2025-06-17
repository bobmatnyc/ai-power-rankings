"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ToolIconProps {
  name: string;
  domain?: string;
  size?: number;
  className?: string;
}

export function ToolIcon({ name, domain, size = 48, className }: ToolIconProps) {
  const [imageError, setImageError] = useState(false);

  // Generate placeholder based on tool name
  const getPlaceholder = () => {
    const initials = name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return initials || name.slice(0, 2).toUpperCase();
  };

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

  if (!domain || imageError) {
    // Show placeholder
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border-2 border-border",
          getGradientClass(name),
          className
        )}
        style={{ width: size, height: size }}
      >
        <span className="text-white font-semibold" style={{ fontSize: size * 0.4 }}>
          {getPlaceholder()}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Image
        src={`/api/favicon?domain=${encodeURIComponent(domain)}&size=${size}`}
        alt={`${name} icon`}
        width={size}
        height={size}
        className={cn("rounded-lg", className)}
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  );
}
