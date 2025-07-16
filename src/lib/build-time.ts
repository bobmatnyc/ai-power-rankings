// This file is used to capture the build time
// The BUILD_TIME will be set at build time via environment variable or during build process

// Get the build time - this will be the time when the build was created
// In production, this should be set via an environment variable or build-time constant
export function getBuildTime(): string {
  // If we have a BUILD_TIME environment variable, use it
  if (process.env.NEXT_PUBLIC_BUILD_TIME) {
    return process.env.NEXT_PUBLIC_BUILD_TIME;
  }

  // Otherwise, use the current time (for development)
  // In production builds, you should set NEXT_PUBLIC_BUILD_TIME
  return new Date().toISOString();
}

export function getFormattedBuildTime(): string {
  const buildTime = getBuildTime();
  const date = new Date(buildTime);
  const now = new Date();

  // Calculate time difference
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Format based on time difference
  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    // Format as date if more than a week
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}
