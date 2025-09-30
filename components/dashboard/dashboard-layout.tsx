"use client";

import { DashboardNav } from "./dashboard-nav";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showBackButton?: boolean;
  backHref?: string;
  navVariant?: "horizontal" | "vertical";
  action?: React.ReactNode;
}

export function DashboardLayout({
  children,
  title,
  description,
  showBackButton = true,
  backHref = "/",
  navVariant = "horizontal",
  action,
}: DashboardLayoutProps) {
  if (navVariant === "vertical") {
    return (
      <div className="flex min-h-screen">
        <DashboardNav variant="vertical" showBackButton={showBackButton} backHref={backHref} />
        <div className="flex-1">
          {(title || description) && (
            <div className="border-b bg-background/95 backdrop-blur">
              <div className="container mx-auto px-6 py-6">
                <div className="flex items-start justify-between">
                  <div>
                    {title && <h1 className="text-2xl font-bold">{title}</h1>}
                    {description && <p className="text-muted-foreground mt-1">{description}</p>}
                  </div>
                  {action}
                </div>
              </div>
            </div>
          )}
          <main className="container mx-auto p-6">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DashboardNav showBackButton={showBackButton} backHref={backHref} />
      {(title || description) && (
        <div className="border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-start justify-between">
              <div>
                {title && <h1 className="text-2xl font-bold">{title}</h1>}
                {description && <p className="text-muted-foreground mt-1">{description}</p>}
              </div>
              {action}
            </div>
          </div>
        </div>
      )}
      <main className="container mx-auto p-6">{children}</main>
    </div>
  );
}
