"use client";

import {
  BarChart3,
  Filter,
  FlaskConical,
  Home,
  Info,
  List,
  Newspaper,
  TrendingUp,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { useRankingChanges } from "@/contexts/ranking-changes-context";
import { useI18n } from "@/i18n/client";
import type { Category } from "@/lib/db/repositories/categories";
import { CategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

// Navigation items will be built dynamically with i18n

// Tag filters will be built dynamically with i18n

function SidebarContent({ categories }: { categories: Category[] }): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const { changes } = useRankingChanges();
  const currentCategory = searchParams.get("category") || "all";
  const currentTags = searchParams.get("tags")?.split(",") || [];
  const { dict, lang } = useI18n();

  const navigationItems = [
    {
      title: dict.navigation.home,
      href: `/${lang}`,
      icon: Home,
    },
    {
      title: dict.navigation.rankings,
      href: `/${lang}/rankings`,
      icon: List,
    },
    {
      title: dict.navigation.news,
      href: `/${lang}/news`,
      icon: Newspaper,
    },
    {
      title: dict.navigation.tools,
      href: `/${lang}/tools`,
      icon: Wrench,
    },
    {
      title: dict.navigation.methodology,
      href: `/${lang}/methodology`,
      icon: FlaskConical,
    },
    {
      title: dict.navigation.about,
      href: `/${lang}/about`,
      icon: Info,
    },
  ];

  const handleNavClick = (): void => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const createFilterUrl = (type: string, value: string): string => {
    const params = new URLSearchParams(searchParams.toString());

    if (type === "category") {
      if (value === "all") {
        params.delete("category");
      } else {
        params.set("category", value);
      }
    } else if (type === "tag") {
      // Single-select behavior: only one tag at a time
      const tags = currentTags.includes(value)
        ? []              // Deselect if clicking same tag
        : [value];        // Replace with new tag (single selection)

      if (tags.length === 0) {
        params.delete("tags");
      } else {
        params.set("tags", tags.join(","));
      }
    }

    const queryString = params.toString();

    // Context-aware routing based on current page
    const basePath = pathname.split('/').slice(0, 3).join('/'); // Gets /{lang}/{page}

    if (basePath.endsWith('/tools')) {
      // If on tools page, keep on tools page with filters
      return `/${lang}/tools${queryString ? `?${queryString}` : ""}`;
    } else if (basePath.endsWith('/rankings')) {
      // If on rankings page, keep on rankings page with filters
      return `/${lang}/rankings${queryString ? `?${queryString}` : ""}`;
    } else if (basePath.endsWith('/news')) {
      // If on news page, keep on news page with filters
      return `/${lang}/news${queryString ? `?${queryString}` : ""}`;
    } else {
      // From other pages, navigate to rankings with filter
      return `/${lang}/rankings${queryString ? `?${queryString}` : ""}`;
    }
  };

  const tagFilters = [
    { id: "autocomplete", name: dict.features.autocomplete, count: 15 },
    { id: "chat", name: dict.features.chat, count: 18 },
    { id: "code-generation", name: dict.features.codeGeneration, count: 20 },
    { id: "refactoring", name: dict.features.refactoring, count: 12 },
    { id: "testing", name: dict.features.testing, count: 8 },
    { id: "documentation", name: dict.features.documentation, count: 10 },
  ];

  return (
    <Sidebar>
      <div className="p-6 h-full overflow-y-auto">
        <Link
          href={`/${lang}`}
          onClick={handleNavClick}
          className="flex items-end gap-3 mb-6"
        >
          <Image
            src="/crown-of-technology.webp"
            alt="AI Power Ranking"
            width={36}
            height={36}
            className="w-9 h-9 object-contain flex-shrink-0"
            loading="eager"
            priority
          />
          <h1 className="text-2xl font-bold text-gradient leading-none -mb-1">APR</h1>
        </Link>

        <div className="space-y-6">
          {/* Navigation */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {dict.sidebar.navigation}
            </h3>
            <nav className="space-y-1">
              {navigationItems.map((item) => {
                // Calculate badge count based on navigation item
                let badgeCount = 0;
                let badgeVariant: "default" | "secondary" | "success" | "destructive" = "default";

                if (changes && changes.totalChanges > 0 && changes.lastUpdated) {
                  const hoursSinceUpdate =
                    (Date.now() - new Date(changes.lastUpdated).getTime()) / (1000 * 60 * 60);

                  if (hoursSinceUpdate < 24) {
                    if (item.href === `/${lang}/rankings`) {
                      badgeCount = changes.totalChanges;
                      badgeVariant = "default";
                    } else if (item.href === `/${lang}/news`) {
                      badgeCount = changes.newEntries;
                      badgeVariant = "success";
                    } else if (item.href === `/${lang}/tools`) {
                      badgeCount = changes.movedUp + changes.movedDown;
                      badgeVariant = "secondary";
                    }
                  }
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                      pathname === item.href
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </div>
                    {badgeCount > 0 && (
                      <Badge variant={badgeVariant} className="ml-auto">
                        {badgeCount}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <Separator className="bg-border/50" />

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {dict.sidebar.quickLinks}
            </h3>
            <nav className="space-y-1">
              <Link
                href={`/${lang}/rankings?sort=trending`}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  pathname === `/${lang}/rankings` && searchParams.get("sort") === "trending"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                <span>{dict.sidebar.trending}</span>
              </Link>
              <Link
                href={`/${lang}/trending`}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  pathname === `/${lang}/trending`
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span>{dict.sidebar.historicalTrends}</span>
              </Link>
            </nav>
          </div>

          <Separator className="bg-border/50" />

          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {dict.sidebar.categories}
            </h3>
            <div className="space-y-1">
              {categories.map((category) => {
                // Determine if this category is currently active
                const isActive = currentCategory === category.id;

                return (
                  <Link
                    key={category.id}
                    href={createFilterUrl("category", category.id)}
                    onClick={handleNavClick}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 text-sm rounded-md transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {category.id !== "all" ? (
                        <CategoryIcon
                          category={category.id}
                          className={cn(
                            "transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                          size={16}
                        />
                      ) : (
                        <List
                          className={cn(
                            "h-4 w-4 transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                      )}
                      <span className="transition-colors">{category.name}</span>
                    </div>
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={cn(
                        "text-xs transition-all",
                        isActive ? "bg-primary/20" : ""
                      )}
                    >
                      {category.count}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Tags */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {dict.sidebar.features}
            </h3>
            <div className="space-y-1">
              {tagFilters.map((tag) => {
                const isActive = currentTags.includes(tag.id);

                return (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => {
                      window.location.href = createFilterUrl("tag", tag.id);
                      handleNavClick();
                    }}
                    className={cn(
                      "group w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-all duration-200 text-left",
                      isActive
                        ? "bg-primary/10 text-primary font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    <span className="transition-colors">{tag.name}</span>
                    <Badge
                      variant={isActive ? "default" : "outline"}
                      className={cn(
                        "text-xs transition-all",
                        isActive ? "bg-primary/20 border-primary/30" : ""
                      )}
                    >
                      {tag.count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Clear Filters */}
          {(currentCategory !== "all" || currentTags.length > 0) && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link
                href={
                  pathname.includes('/tools')
                    ? `/${lang}/tools`
                    : `/${lang}/rankings`
                }
                onClick={handleNavClick}
              >
                <Filter className="h-4 w-4 mr-2" />
                {dict.sidebar.clearFilters}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Sidebar>
  );
}

export function AppSidebar({ categories }: { categories: Category[] }): React.JSX.Element {
  return <SidebarContent categories={categories} />;
}
