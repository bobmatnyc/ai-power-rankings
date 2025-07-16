"use client";

import { ArrowLeft, Database, FileText, FileUp, Home, Settings, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const dashboardNavItems = [
  {
    title: "Dashboard Home",
    href: "/dashboard",
    icon: Home,
    description: "Overview and quick access",
  },
  {
    title: "Tools",
    href: "/dashboard/tools",
    icon: FileText,
    description: "Manage AI tools",
  },
  {
    title: "Rankings",
    href: "/dashboard/rankings",
    icon: Trophy,
    description: "Preview & generate rankings",
  },
  {
    title: "News",
    href: "/dashboard/news-ingestion",
    icon: FileUp,
    description: "Upload & manage articles",
  },
  {
    title: "Subscribers",
    href: "/dashboard/subscribers",
    icon: Users,
    description: "Newsletter management",
  },
  {
    title: "Cache",
    href: "/dashboard/cache",
    icon: Database,
    description: "Static file management",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    description: "Coming soon",
    disabled: true,
  },
];

interface DashboardNavProps {
  showBackButton?: boolean;
  backHref?: string;
  variant?: "horizontal" | "vertical";
  className?: string;
}

export function DashboardNav({
  showBackButton = true,
  backHref = "/",
  variant = "horizontal",
  className,
}: DashboardNavProps) {
  const pathname = usePathname();

  if (variant === "vertical") {
    return (
      <div className={cn("w-64 border-r bg-muted/30 min-h-screen", className)}>
        <div className="p-6">
          {showBackButton && (
            <Button variant="ghost" size="sm" asChild className="mb-4 w-full justify-start">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Site
              </Link>
            </Button>
          )}

          <nav className="space-y-2">
            {dashboardNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              if (item.disabled) {
                return (
                  <div
                    key={item.href}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed"
                  >
                    <Icon className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs">{item.description}</div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs opacity-70">{item.description}</div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {showBackButton && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={backHref}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Site
                </Link>
              </Button>
            )}

            <nav className="flex items-center space-x-6">
              {dashboardNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                if (item.disabled) {
                  return (
                    <div
                      key={item.href}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed"
                      title={item.description}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    title={item.description}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
