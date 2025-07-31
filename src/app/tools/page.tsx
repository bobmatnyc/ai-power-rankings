"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { getCategoryColor } from "@/lib/category-colors";
import { loggers } from "@/lib/logger";

interface Tool {
  id: string;
  name: string;
  category: string;
  status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
  description?: string;
  website?: string;
  website_url?: string;
  github_url?: string;
  info?: {
    links?: {
      website?: string;
    };
  };
}

export default function ToolsPage(): React.JSX.Element {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  const fetchTools = async (): Promise<void> => {
    try {
      const response = await fetch("/api/tools");
      const data = await response.json();
      setTools(data.tools);
      setLoading(false);
    } catch (error) {
      loggers.tools.error("Failed to fetch tools", { error });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

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

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">AI Coding Tools Directory</h1>
        <p className="text-muted-foreground text-lg">
          Explore all {tools.length} AI coding tools in our database
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === "all"
                  ? "All Categories"
                  : cat.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedTools.map((tool) => (
          <Link key={tool.id} href={`/tools/${tool.id}`} className="flex h-full">
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
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/rankings?category=${tool.category}`;
                    }}
                  >
                    <Badge
                      className={`${getCategoryColor(tool.category)} cursor-pointer hover:opacity-80`}
                    >
                      {tool.category.replace(/-/g, " ")}
                    </Badge>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {tool.description ||
                    "AI-powered coding assistant helping developers write better code faster."}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tools.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{categories.length - 1}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {tools.filter((t) => t.status === "active").length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Source</CardTitle>
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
