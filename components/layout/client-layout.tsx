"use client";

import { usePathname } from "next/navigation";
// CRITICAL FIX: Explicit React import for jsx-dev-runtime stability
import * as React from "react";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  SignInButtonDirect,
  SignedOutDirect,
  SignedInDirect,
  UserButtonDirect,
} from "@/components/auth/clerk-direct-components";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BuildTimeBadge } from "@/components/layout/build-time-badge";
import { Footer } from "@/components/layout/footer";
import { LanguageSelector } from "@/components/layout/language-selector";
import { Button } from "@/components/ui/button";
import { CrownIcon } from "@/components/ui/optimized-image";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { RankingChangesProvider } from "@/contexts/ranking-changes-context";
import { I18nProvider, useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

// CRITICAL FIX: Stabilize component for HMR
const ClientLayoutContent = React.memo(function ClientLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // Check if on home page on mobile to hide header until scroll
  const isHomePage = pathname === `/${lang}`;
  // Disabled header hiding to keep sign-in button always accessible
  const shouldHideHeader = false; // was: isHomePage && !hasScrolled

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
                <div className="flex items-end gap-2 md:hidden">
                  <CrownIcon size="sm" className="w-6 h-6" />
                  <span className="font-bold text-sm leading-none">{dict.common.appName}</span>
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

                {/* Auth buttons - using direct Clerk components */}
                <SignedOutDirect>
                  <SignInButtonDirect mode="redirect" forceRedirectUrl={`/${lang}`}>
                    <Button size="sm" variant="outline">
                      Sign In For Updates
                    </Button>
                  </SignInButtonDirect>
                </SignedOutDirect>

                <SignedInDirect>
                  <UserButtonDirect afterSignOutUrl={`/${lang}`} />
                </SignedInDirect>
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
});

// CRITICAL FIX: Stabilize main export for HMR
export const ClientLayout = React.memo(function ClientLayout({
  children,
  lang,
  dict,
}: {
  children: React.ReactNode;
  lang: Locale;
  dict: Dictionary;
}) {
  return (
    <ErrorBoundary>
      <I18nProvider dict={dict} lang={lang}>
        <RankingChangesProvider>
          <ClientLayoutContent>{children}</ClientLayoutContent>
        </RankingChangesProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
});
