/**
 * Calculate tier based on ranking position
 * S: 1-5, A: 6-15, B: 16-25, C: 26-35, D: 36+
 */
export function calculateTier(rank: number): string {
  if (rank <= 5) {
    return "S";
  }
  if (rank <= 15) {
    return "A";
  }
  if (rank <= 25) {
    return "B";
  }
  if (rank <= 35) {
    return "C";
  }
  return "D";
}

/**
 * Get tier color classes for badges
 */
export function getTierColor(tier: string): string {
  // #190 C2 (Option B): the --ds-score-* bands, text in --ds-score-fg (AA in both modes).
  switch (tier) {
    case "S":
      return "bg-ds-score-s text-ds-score-fg border-0";
    case "A":
      return "bg-ds-score-a text-ds-score-fg border-0";
    case "B":
      return "bg-ds-score-b text-ds-score-fg border-0";
    case "C":
      return "bg-ds-score-c text-ds-score-fg border-0";
    case "D":
      return "bg-ds-score-d text-ds-score-fg border-0";
    default:
      return "bg-muted text-muted-foreground";
  }
}
