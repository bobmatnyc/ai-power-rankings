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
  switch (tier) {
    case "S":
      return "bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0";
    case "A":
      return "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0";
    case "B":
      return "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0";
    case "C":
      return "bg-gradient-to-r from-gray-500 to-slate-500 text-white border-0";
    case "D":
      return "bg-gradient-to-r from-orange-500 to-red-500 text-white border-0";
    default:
      return "bg-muted text-muted-foreground";
  }
}
