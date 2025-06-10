"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BuildTimeBadge } from "@/components/layout/build-time-badge";

export function ClientLayout({ children }: { children: React.ReactNode }): React.JSX.Element {

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
            <div className="flex items-center justify-between p-4">
              <SidebarTrigger className="hover:bg-muted" />
              <div className="flex-1 max-w-2xl mx-4">
                {/* Search could go here in the future */}
              </div>
              <div className="flex items-center space-x-2">
                <BuildTimeBadge />
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}