// Centralized category color system
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "ide-assistant": "bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-400",
    "autonomous-agent": "bg-purple-100 text-purple-900 dark:bg-purple-900/20 dark:text-purple-400",
    "code-completion": "bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-400",
    testing: "bg-orange-100 text-orange-900 dark:bg-orange-900/20 dark:text-orange-400",
    documentation: "bg-pink-100 text-pink-900 dark:bg-pink-900/20 dark:text-pink-400",
    "code-review": "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-400",
    security: "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-400",
    "cloud-ide": "bg-cyan-100 text-cyan-900 dark:bg-cyan-900/20 dark:text-cyan-400",
    collaboration: "bg-teal-100 text-teal-900 dark:bg-teal-900/20 dark:text-teal-400",
    "ai-chat": "bg-violet-100 text-violet-900 dark:bg-violet-900/20 dark:text-violet-400",
    "devops-assistant":
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400",
    product: "bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-400",
    default: "bg-gray-100 text-gray-900 dark:bg-gray-900/20 dark:text-gray-400",
  };

  return (
    colors[category] ||
    colors["default"] ||
    "bg-gray-100 text-gray-900 dark:bg-gray-900/20 dark:text-gray-400"
  );
}

// Get just the background color class (for cases where text color is handled separately)
export function getCategoryBgColor(category: string): string {
  const colors: Record<string, string> = {
    "ide-assistant": "bg-blue-100 dark:bg-blue-900/20",
    "autonomous-agent": "bg-purple-100 dark:bg-purple-900/20",
    "code-completion": "bg-green-100 dark:bg-green-900/20",
    testing: "bg-orange-100 dark:bg-orange-900/20",
    documentation: "bg-pink-100 dark:bg-pink-900/20",
    "code-review": "bg-indigo-100 dark:bg-indigo-900/20",
    security: "bg-red-100 dark:bg-red-900/20",
    "cloud-ide": "bg-cyan-100 dark:bg-cyan-900/20",
    collaboration: "bg-teal-100 dark:bg-teal-900/20",
    "ai-chat": "bg-violet-100 dark:bg-violet-900/20",
    "devops-assistant": "bg-emerald-100 dark:bg-emerald-900/20",
    product: "bg-amber-100 dark:bg-amber-900/20",
    default: "bg-gray-100 dark:bg-gray-900/20",
  };

  return colors[category] || colors["default"] || "bg-gray-100 dark:bg-gray-900/20";
}

// Get just the text color class
export function getCategoryTextColor(category: string): string {
  const colors: Record<string, string> = {
    "ide-assistant": "text-blue-900 dark:text-blue-400",
    "autonomous-agent": "text-purple-900 dark:text-purple-400",
    "code-completion": "text-green-900 dark:text-green-400",
    testing: "text-orange-900 dark:text-orange-400",
    documentation: "text-pink-900 dark:text-pink-400",
    "code-review": "text-indigo-900 dark:text-indigo-400",
    security: "text-red-900 dark:text-red-400",
    "cloud-ide": "text-cyan-900 dark:text-cyan-400",
    collaboration: "text-teal-900 dark:text-teal-400",
    "ai-chat": "text-violet-900 dark:text-violet-400",
    "devops-assistant": "text-emerald-900 dark:text-emerald-400",
    product: "text-amber-900 dark:text-amber-400",
    default: "text-gray-900 dark:text-gray-400",
  };

  return colors[category] || colors["default"] || "text-gray-900 dark:text-gray-400";
}
