"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BuildTimeBadge } from "@/components/layout/build-time-badge";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { I18nProvider, useI18n } from "@/i18n/client";
import { LanguageSelector } from "@/components/layout/language-selector";
import { Footer } from "@/components/layout/footer";
import { RankingChangesProvider } from "@/contexts/ranking-changes-context";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

function ClientLayoutContent({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [hasScrolled, setHasScrolled] = useState(false);
  const { dict, lang } = useI18n();

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setHasScrolled(scrollY > 10);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // On home page on mobile, hide header until scroll
  const isHomePage = pathname === `/${lang}`;
  const shouldHideHeader = isHomePage && !hasScrolled;

  const handleSubscribeClick = (): void => {
    // Navigate to about page with a query param to open the modal
    router.push(`/${lang}/about?subscribe=true`);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div
            className={`fixed top-0 left-0 right-0 md:left-auto md:relative z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 transition-transform duration-300 md:translate-y-0 ${
              shouldHideHeader ? "-translate-y-full md:translate-y-0" : "translate-y-0"
            }`}
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="hover:bg-muted" />
                {/* Mobile logo */}
                <div className="flex items-center gap-2 md:hidden">
                  <img
                    src="/crown-of-technology.png"
                    alt="AI Power Ranking"
                    className="w-6 h-6 object-contain"
                  />
                  <span className="font-bold text-sm">{dict.common.appName}</span>
                </div>
              </div>

              <div className="flex-1 flex justify-center">
                <div className="hidden md:block">
                  <BuildTimeBadge />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Language selector */}
                <LanguageSelector />

                {/* Desktop button */}
                <Button
                  onClick={handleSubscribeClick}
                  size="sm"
                  className="hidden md:flex items-center gap-2"
                >
                  <Bell className="h-4 w-4" />
                  {dict.navigation.subscribeToUpdates}
                </Button>

                {/* Mobile icon button */}
                <Button
                  onClick={handleSubscribeClick}
                  size="icon"
                  variant="ghost"
                  className="md:hidden"
                >
                  <Bell className="h-5 w-5" />
                  <span className="sr-only">{dict.navigation.subscribeToUpdates}</span>
                </Button>
              </div>
            </div>
          </div>

          <div
            className={`flex-1 overflow-auto transition-all duration-300 ${
              shouldHideHeader ? "pt-0 md:pt-0" : "pt-[73px] md:pt-0"
            }`}
          >
            <div className="min-h-full flex flex-col">
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export function ClientLayout({
  children,
  lang,
  dict,
}: {
  children: React.ReactNode;
  lang: Locale;
  dict: Dictionary;
}): React.JSX.Element {
  return (
    <I18nProvider dict={dict} lang={lang}>
      <RankingChangesProvider>
        <ClientLayoutContent>{children}</ClientLayoutContent>
      </RankingChangesProvider>
    </I18nProvider>
  );
}
