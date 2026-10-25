"use client";

import { Filter, List } from "lucide-react";
// Note: Using native <img> instead of next/image to avoid Next.js generating invalid preload tags
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { useI18n } from "@/i18n/client";
import { pageTypeFromPath, trackEvent } from "@/lib/analytics/track";
import type { Category } from "@/lib/db/repositories/categories";
import { CategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

// Navigation items will be built dynamically with i18n

// Tag filters will be built dynamically with i18n

function SidebarContent({ categories }: { categories: Category[] }): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const currentCategory = searchParams.get("category") || "all";
  const currentTags = searchParams.get("tags")?.split(",") || [];
  const { dict, lang } = useI18n();

  // Debug: Log current category for troubleshooting
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("[Sidebar] currentCategory:", currentCategory, "from URL:", searchParams.get("category"));
  }

  const handleNavClick = (): void => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // #175: filter values are fixed category/tag ids, never free text.
  const trackFilter = (filterName: "category" | "tag", value: string): void =>
    trackEvent("filter_use", {
      filter_name: filterName,
      filter_value: value,
      page_type: pageTypeFromPath(pathname),
    });

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
          <img
            src="/crown-of-technology-36.webp"
            alt="AI Power Ranking"
            width={36}
            height={36}
            className="w-9 h-9 object-contain flex-shrink-0"
            loading="eager"
          />
          <h1 className="text-2xl font-bold text-gradient leading-none -mb-1">APR</h1>
        </Link>

        <div className="space-y-6">
          {/* #194: the page links moved to the header nav (components/layout/site-nav.tsx) */}
          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {dict.sidebar.categories}
            </h3>
            <div className="space-y-1">
              {categories.map((category) => {
                // Determine if this category is currently active
                // When no category param: currentCategory = "all"
                // When ?category=X: currentCategory = X
                const isActive = currentCategory === category.id;

                return (
                  <Link
                    key={`${category.id}-${currentCategory}`}
                    href={createFilterUrl("category", category.id)}
                    onClick={() => {
                      // #175: sidebar category links are the site-wide category filter.
                      trackFilter("category", category.id);
                      handleNavClick();
                    }}
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
                      <span className="transition-colors">
                        {category.id === "all"
                          ? (dict.navigation?.allCategories ?? category.name)
                          : (dict.tools?.categories?.[category.id as keyof typeof dict.tools.categories] ?? category.name)}
                      </span>
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
                      // #175: tag buttons are the feature filter.
                      trackFilter("tag", tag.id);
                      // #175: client-side navigation, like the category links, keeps the page loaded so gtag sends filter_use.
                      router.push(createFilterUrl("tag", tag.id));
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
