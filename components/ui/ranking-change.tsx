"use client";

import { Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// #178: the rank-delta colours and gap come from the sample --ds-* design-agent
// tokens (app/globals.css). Values equal the Tailwind palette classes they
// replaced, except light rank-up.
// #190: light rank-up is green-700 (was green-600) to meet AA on white.

interface RankingChangeProps {
  previousRank?: number;
  currentRank: number;
  changeReason?: string;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RankingChange({
  previousRank,
  currentRank,
  changeReason,
  className,
  showIcon = true,
  size = "md",
}: RankingChangeProps) {
  // If no previous rank, it's a new entry
  if (!previousRank) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-ds-inline font-medium text-ds-rank-up",
                size === "sm" && "text-xs",
                size === "md" && "text-sm",
                size === "lg" && "text-base",
                className
              )}
            >
              {showIcon && <Sparkles className={cn("h-3 w-3", size === "lg" && "h-4 w-4")} />}
              NEW
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>New to rankings</p>
            {changeReason && <p className="text-xs text-muted-foreground mt-1">{changeReason}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const change = previousRank - currentRank;

  // No change
  if (change === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-ds-inline font-medium text-ds-rank-steady",
                size === "sm" && "text-xs",
                size === "md" && "text-sm",
                size === "lg" && "text-base",
                className
              )}
            >
              {showIcon && <Minus className={cn("h-3 w-3", size === "lg" && "h-4 w-4")} />}—
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>No change from #{previousRank}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Positive change (moved up)
  if (change > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-ds-inline font-medium text-ds-rank-up",
                size === "sm" && "text-xs",
                size === "md" && "text-sm",
                size === "lg" && "text-base",
                className
              )}
            >
              {showIcon && <TrendingUp className={cn("h-3 w-3", size === "lg" && "h-4 w-4")} />}↑
              {change}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Up from #{previousRank} to #{currentRank}
            </p>
            {changeReason && <p className="text-xs text-muted-foreground mt-1">{changeReason}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Negative change (moved down)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-ds-inline font-medium text-ds-rank-down",
              size === "sm" && "text-xs",
              size === "md" && "text-sm",
              size === "lg" && "text-base",
              className
            )}
          >
            {showIcon && <TrendingDown className={cn("h-3 w-3", size === "lg" && "h-4 w-4")} />}↓
            {Math.abs(change)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Down from #{previousRank} to #{currentRank}
          </p>
          {changeReason && <p className="text-xs text-muted-foreground mt-1">{changeReason}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
