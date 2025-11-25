/**
 * Character Counter Component
 *
 * Displays character count with color-coded thresholds.
 * Green: < 80%, Yellow/Orange: 80-95%, Red: > 95%
 *
 * @example
 * <CharacterCounter current={1234} max={50000} label="Content" />
 */

import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  max: number;
  label?: string;
  warningThreshold?: number; // Default: 0.8 (80%)
  errorThreshold?: number;   // Default: 0.95 (95%)
}

export function CharacterCounter({
  current,
  max,
  label,
  warningThreshold = 0.8,
  errorThreshold = 0.95,
}: CharacterCounterProps) {
  const percentage = max > 0 ? current / max : 0;

  // Determine color based on thresholds
  const getColor = () => {
    if (percentage >= errorThreshold) {
      return "text-red-600 dark:text-red-400";
    }
    if (percentage >= warningThreshold) {
      return "text-orange-600 dark:text-orange-400";
    }
    return "text-green-600 dark:text-green-400";
  };

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="text-xs font-medium">
      {label && <span className="text-muted-foreground mr-1">{label}:</span>}
      <span className={cn("transition-colors", getColor())}>
        {formatNumber(current)} / {formatNumber(max)}
      </span>
      <span className="text-muted-foreground ml-1">
        ({Math.round(percentage * 100)}%)
      </span>
    </div>
  );
}
