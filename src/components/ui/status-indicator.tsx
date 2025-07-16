import type { Dictionary } from "@/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
  className?: string;
  showLabel?: boolean;
  dictionary?: Dictionary["status"];
}

export function StatusIndicator({
  status,
  className,
  showLabel = false,
  dictionary,
}: StatusIndicatorProps): React.JSX.Element {
  // Map status to traffic light colors and labels
  const getStatusConfig = () => {
    const labels = dictionary || {
      active: { label: "Active", title: "Actively maintained and updated" },
      beta: { label: "Beta", title: "In beta testing phase" },
      deprecated: { label: "Deprecated", title: "No longer actively maintained" },
      discontinued: { label: "Discontinued", title: "Service has been shut down" },
      acquired: { label: "Acquired", title: "Company has been acquired" },
    };

    // Helper function to get label and title, handling both string and object formats
    const getStatusText = (statusKey: keyof typeof labels) => {
      const status = labels[statusKey];
      if (typeof status === "string") {
        return { label: status, title: status };
      }
      return { label: status.label, title: status.title };
    };

    return {
      active: {
        color: "bg-green-500",
        ...getStatusText("active"),
      },
      beta: {
        color: "bg-yellow-500",
        ...getStatusText("beta"),
      },
      deprecated: {
        color: "bg-orange-500",
        ...getStatusText("deprecated"),
      },
      discontinued: {
        color: "bg-red-500",
        ...getStatusText("discontinued"),
      },
      acquired: {
        color: "bg-blue-500",
        ...getStatusText("acquired"),
      },
    };
  };

  const statusConfig = getStatusConfig();

  const config = statusConfig[status] || statusConfig.active;

  return (
    <div className={cn("flex items-center gap-1.5", className)} title={config.title}>
      {/* Traffic light container */}
      <div className="flex items-center gap-0.5 px-1 py-0.5 bg-gray-900 dark:bg-gray-800 rounded">
        {/* Three lights in horizontal layout */}
        <div
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-200",
            status === "active" ? config.color : "bg-gray-600 dark:bg-gray-700"
          )}
        />
        <div
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-200",
            status === "beta" || status === "deprecated"
              ? statusConfig[status].color
              : "bg-gray-600 dark:bg-gray-700"
          )}
        />
        <div
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-200",
            status === "discontinued" ? config.color : "bg-gray-600 dark:bg-gray-700"
          )}
        />
      </div>

      {showLabel && <span className="text-xs text-muted-foreground">{config.label}</span>}
    </div>
  );
}
