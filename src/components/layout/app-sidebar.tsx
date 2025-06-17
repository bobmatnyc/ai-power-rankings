"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { loggers } from "@/lib/logger";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import {
  Home,
  List,
  TrendingUp,
  Filter,
  Newspaper,
  FlaskConical,
  Info,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { Dictionary } from "@/i18n/get-dictionary";

// Navigation items will be built dynamically with i18n

// Helper function to get category name from dictionary
function getCategoryName(categoryId: string, categories: Dictionary["categories"]): string {
  const categoryKey = categoryId.replace(/-/g, "") as keyof typeof categories;
  return (
    categories[categoryKey] ||
    categoryId
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

interface Category {
  id: string;
  name: string;
  count: number;
}

// Tag filters will be built dynamically with i18n

function SidebarContent(): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const currentCategory = searchParams.get("category") || "all";
  const currentTags = searchParams.get("tags")?.split(",") || [];
  const [categories, setCategories] = useState<Category[]>([]);
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

  const fetchCategories = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/tools");
      const data = await response.json();

      // Extract categories from tools
      const categoryMap: Record<string, number> = {};
      data.tools?.forEach((tool: { category?: string }) => {
        if (tool.category) {
          categoryMap[tool.category] = (categoryMap[tool.category] || 0) + 1;
        }
      });

      // Convert the object to array format
      const categoryArray: Category[] = Object.entries(categoryMap).map(([id, count]) => ({
        id,
        name: getCategoryName(id, dict.categories),
        count: count as number,
      }));

      // Calculate total
      const total = data.tools?.length || 0;

      // Add "All Categories" at the beginning
      const allCategories = [
        { id: "all", name: "All Categories", count: total },
        ...categoryArray.sort((a, b) => b.count - a.count),
      ];

      setCategories(allCategories);
    } catch (error) {
      loggers.tools.error("Failed to fetch categories", { error });
      // Fallback to some default categories
      setCategories([{ id: "all", name: "All Categories", count: 0 }]);
    }
  }, [dict.categories]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
      const tags = currentTags.includes(value)
        ? currentTags.filter((t) => t !== value)
        : [...currentTags, value];

      if (tags.length === 0) {
        params.delete("tags");
      } else {
        params.set("tags", tags.join(","));
      }
    }

    const queryString = params.toString();
    return `/${lang}/rankings${queryString ? `?${queryString}` : ""}`;
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
          className="flex items-center space-x-3 mb-6"
        >
          <img
            src="/crown-of-technology.png"
            alt="AI Power Ranking"
            className="w-9 h-9 object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-gradient">APR</h1>
          </div>
        </Link>

        <div className="space-y-6">
          {/* Navigation */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {dict.sidebar.navigation}
            </h3>
            <nav className="space-y-1">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                    pathname === item.href
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              ))}
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
            </nav>
          </div>

          <Separator className="bg-border/50" />

          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {dict.sidebar.categories}
            </h3>
            <div className="space-y-1">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={createFilterUrl("category", category.id)}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                    currentCategory === category.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{category.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {category.count}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Tags */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {dict.sidebar.features}
            </h3>
            <div className="space-y-1">
              {tagFilters.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    window.location.href = createFilterUrl("tag", tag.id);
                    handleNavClick();
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left",
                    currentTags.includes(tag.id)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{tag.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {tag.count}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Clear Filters */}
          {(currentCategory !== "all" || currentTags.length > 0) && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={`/${lang}/rankings`} onClick={handleNavClick}>
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

export function AppSidebar(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <Sidebar>
          <div className="p-6">Loading...</div>
        </Sidebar>
      }
    >
      <SidebarContent />
    </Suspense>
  );
}
