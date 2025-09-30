import * as React from "react";
import { cn } from "@/lib/utils";

interface CrownIconProps extends React.SVGProps<SVGSVGElement> {
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12"
};

export function CrownIcon({ size = "md", className, ...props }: CrownIconProps) {
  return (
    <svg
      className={cn("text-yellow-500", sizeMap[size], className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M5 16L3 4l5.5 5L12 4l3.5 5L21 4l-2 12H5zm2.7-2h8.6l.9-5.4-2.1 1.4L12 8l-3.1 2 -2.1-1.4L7.7 14z"/>
    </svg>
  );
}