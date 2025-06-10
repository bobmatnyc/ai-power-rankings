"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { Home, List, TrendingUp, Filter, Newspaper, FlaskConical, Info, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    title: "Home",
    href: "/",
    icon: Home,
  },
  {
    title: "Rankings",
    href: "/rankings",
    icon: List,
  },
  {
    title: "News",
    href: "/news",
    icon: Newspaper,
  },
  {
    title: "Tools",
    href: "/tools", 
    icon: Wrench,
  },
  {
    title: "Methodology",
    href: "/methodology",
    icon: FlaskConical,
  },
  {
    title: "About",
    href: "/about",
    icon: Info,
  },
];

interface Category {
  id: string;
  name: string;
  count: number;
}

const tagFilters = [
  { id: 'autocomplete', name: 'Autocomplete', count: 15 },
  { id: 'chat', name: 'Chat Interface', count: 18 },
  { id: 'code-generation', name: 'Code Generation', count: 20 },
  { id: 'refactoring', name: 'Refactoring', count: 12 },
  { id: 'testing', name: 'Testing', count: 8 },
  { id: 'documentation', name: 'Documentation', count: 10 },
];

export function AppSidebar(): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const currentCategory = searchParams.get('category') || 'all';
  const currentTags = searchParams.get('tags')?.split(',') || [];
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async (): Promise<void> => {
    try {
      const response = await fetch('/api/mcp/categories');
      const data = await response.json();
      
      // Convert the object to array format
      const categoryArray: Category[] = Object.entries(data).map(([id, count]) => ({
        id,
        name: id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        count: count as number
      }));
      
      // Calculate total
      const total = categoryArray.reduce((sum, cat) => sum + cat.count, 0);
      
      // Add "All Categories" at the beginning
      const allCategories = [
        { id: 'all', name: 'All Categories', count: total },
        ...categoryArray.sort((a, b) => b.count - a.count)
      ];
      
      setCategories(allCategories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      // Fallback to some default categories
      setCategories([
        { id: 'all', name: 'All Categories', count: 0 }
      ]);
    }
  };

  const handleNavClick = (): void => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const createFilterUrl = (type: string, value: string): string => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (type === 'category') {
      if (value === 'all') {
        params.delete('category');
      } else {
        params.set('category', value);
      }
    } else if (type === 'tag') {
      const tags = currentTags.includes(value)
        ? currentTags.filter(t => t !== value)
        : [...currentTags, value];
      
      if (tags.length === 0) {
        params.delete('tags');
      } else {
        params.set('tags', tags.join(','));
      }
    }
    
    const queryString = params.toString();
    return `/rankings${queryString ? `?${queryString}` : ''}`;
  };

  return (
    <Sidebar>
      <div className="p-6 h-full overflow-y-auto">
        <Link href="/" onClick={handleNavClick} className="flex items-center space-x-3 mb-6">
          <img 
            src="/crown-of-technology.png" 
            alt="AI Power Rankings" 
            className="w-9 h-9 object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Power Rankings</h1>
            <p className="text-xs text-muted-foreground">Discover the best AI tools</p>
          </div>
        </Link>

        <div className="space-y-6">
          {/* Navigation */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Navigation
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
              Quick Links
            </h3>
            <nav className="space-y-1">
              <Link
                href="/rankings?sort=trending"
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  pathname === "/rankings" && searchParams.get("sort") === "trending"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                <span>Trending</span>
              </Link>
            </nav>
          </div>

          <Separator className="bg-border/50" />

          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Categories
            </h3>
            <div className="space-y-1">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={createFilterUrl('category', category.id)}
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
              Features
            </h3>
            <div className="space-y-1">
              {tagFilters.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    window.location.href = createFilterUrl('tag', tag.id);
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
          {(currentCategory !== 'all' || currentTags.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <Link href="/rankings" onClick={handleNavClick}>
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Sidebar>
  );
}