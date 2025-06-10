"use client";

import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BuildTimeBadge } from "@/components/layout/build-time-badge";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export function ClientLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();

  const handleSubscribeClick = (): void => {
    // Navigate to about page with a query param to open the modal
    router.push("/about?subscribe=true");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
            <div className="flex items-center justify-between p-4">
              <SidebarTrigger className="hover:bg-muted" />
              <div className="flex-1 flex justify-center">
                <BuildTimeBadge />
              </div>
              <Button onClick={handleSubscribeClick} size="sm" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Subscribe To Updates
              </Button>
            </div>
          </div>

          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
