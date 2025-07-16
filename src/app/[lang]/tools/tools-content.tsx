"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { ToolIcon } from "@/components/ui/tool-icon";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getCategoryColor } from "@/lib/category-colors";
import { extractTextFromRichText } from "@/lib/richtext-utils";

interface RichTextElement {
  type: string;
  children?: Array<{ text: string; type?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface Tool {
  id: string;
  slug?: string;
  name: string;
  category: string;
  status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
  description?: string | RichTextElement[]; // Can be string or RichText array
  website?: string;
  website_url?: string;
  github_url?: string;
  info?: {
    links?: {
      website?: string;
    };
    business?: {
      pricing_model?: string;
      base_price?: number;
      pricing_details?: Record<string, string>;
    };
  };
}

interface ToolsContentProps {
  tools: Tool[];
  loading: boolean;
  lang: Locale;
  dict: Dictionary;
}

export function ToolsContent({ tools, loading, lang, dict }: ToolsContentProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  const categories = ["all", ...new Set(tools.map((t) => t.category))];

  const filteredTools =
    selectedCategory === "all" ? tools : tools.filter((t) => t.category === selectedCategory);

  const sortedTools = [...filteredTools].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "category":
        return a.category.localeCompare(b.category);
      case "status":
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  const getCategoryName = (category: string): string => {
    const categoryKey = category.replace(/-/g, "") as keyof typeof dict.categories;
    return (
      dict.categories[categoryKey] ||
      category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{dict.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{dict.tools.title}</h1>
        <p className="text-muted-foreground text-lg">
          {dict.tools.subtitle.replace("{count}", tools.length.toString())}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={dict.tools.filterByCategory} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === "all" ? dict.tools.allCategories : getCategoryName(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={dict.tools.sortBy} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{dict.tools.sort.name}</SelectItem>
            <SelectItem value="category">{dict.tools.sort.category}</SelectItem>
            <SelectItem value="status">{dict.tools.sort.status}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedTools.map((tool) => (
          <Link
            key={tool.id}
            href={`/${lang}/tools/${tool.slug || tool.id}`}
            className="flex h-full"
          >
            <Card className="hover:shadow-lg transition-shadow cursor-pointer w-full flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <ToolIcon
                      name={tool.name}
                      domain={tool.website_url || tool.website || tool.info?.links?.website}
                      size={48}
                      className="flex-shrink-0"
                    />
                    <CardTitle className="text-xl">{tool.name}</CardTitle>
                  </div>
                  <StatusIndicator status={tool.status} showLabel />
                </div>
                <CardDescription>
                  <button
                    type="button"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      window.location.href = `/${lang}/rankings?category=${tool.category}`;
                    }}
                    onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        window.location.href = `/${lang}/rankings?category=${tool.category}`;
                      }
                    }}
                    className="bg-transparent border-none p-0 cursor-pointer"
                    aria-label={`Filter by ${getCategoryName(tool.category)} category`}
                  >
                    <Badge
                      className={`${getCategoryColor(tool.category)} cursor-pointer hover:opacity-80`}
                    >
                      {getCategoryName(tool.category)}
                    </Badge>
                  </button>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {extractTextFromRichText(tool.description) || dict.tools.defaultDescription}
                </p>

                {/* Show pricing model if available */}
                {tool.info?.business?.pricing_model && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {tool.info.business.pricing_model === "freemium"
                        ? "Freemium"
                        : tool.info.business.pricing_model === "free"
                          ? "Free"
                          : tool.info.business.pricing_model === "subscription"
                            ? "Subscription"
                            : tool.info.business.pricing_model === "usage-based"
                              ? "Usage-based"
                              : tool.info.business.pricing_model === "enterprise"
                                ? "Enterprise"
                                : tool.info.business.pricing_model}
                    </Badge>
                    {tool.info.business.base_price !== undefined &&
                      tool.info.business.base_price > 0 && (
                        <span className="text-xs text-muted-foreground">
                          from ${tool.info.business.base_price}/mo
                        </span>
                      )}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{dict.tools.stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tools.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{dict.tools.stats.categories}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{categories.length - 1}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{dict.tools.stats.active}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {tools.filter((t) => t.status === "active").length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{dict.tools.stats.openSource}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {tools.filter((t) => t.category === "open-source-framework").length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
