"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToolIcon } from "@/components/ui/tool-icon";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { ToolDetailTabs } from "@/components/tools/tool-detail-tabs";
import type { Dictionary } from "@/i18n/get-dictionary";

interface Tool {
  id: string;
  slug?: string;
  name: string;
  category: string;
  status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
  info?: any;
  website_url?: string;
  github_repo?: string;
  description?: string;
  tagline?: string;
  pricing_model?: string;
  license_type?: string;
  logo_url?: string;
}

interface ToolDetailClientProps {
  slug: string;
  lang: string;
  dict: Dictionary;
}

export function ToolDetailClient({ slug, lang, dict }: ToolDetailClientProps) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTools() {
      try {
        const response = await fetch("/api/tools");
        if (!response.ok) {
          throw new Error("Failed to fetch tools");
        }

        const data = await response.json();
        const tools = data.tools || [];

        // Find the tool by slug
        const foundTool = tools.find((t: Tool) => (t.slug || t.id) === slug);

        setTool(foundTool || null);
      } catch (error) {
        console.error("Failed to fetch tool details", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTools();
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{dict.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground mb-4">{dict.tools.notFound}</p>
          <Button asChild>
            <Link href={`/${lang}/tools`}>{dict.tools.backToTools}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Extract data from tool
  const info = tool.info || {};
  const links = info.links || {};
  const product = info.product || {};
  const company = info.company || {};

  const websiteUrl = links.website || tool.website_url;
  const githubUrl = links.github || tool.github_repo;
  const description = product.description || tool.description;
  const tagline = product.tagline || tool.tagline;
  const pricingModel = product.pricing_model || tool.pricing_model;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href={`/${lang}/tools`} className="hover:text-foreground">
            {dict.navigation.tools}
          </Link>
          <span>/</span>
          <span>{tool.name}</span>
        </div>

        {/* Category Badge - Centered on mobile */}
        <div className="mb-4 md:hidden flex justify-center">
          <Badge className="capitalize px-4 py-1 text-xs">{tool.category.replace(/-/g, " ")}</Badge>
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <ToolIcon
              name={tool.name}
              domain={websiteUrl}
              size={64}
              className="flex-shrink-0 mt-1"
            />
            <div>
              <h1 className="text-2xl md:text-4xl font-bold mb-2">{tool.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="capitalize hidden md:inline-flex">
                  {tool.category.replace(/-/g, " ")}
                </Badge>
                <StatusIndicator status={tool.status} showLabel />
              </div>
            </div>
          </div>

          {/* Desktop buttons */}
          <div className="hidden md:flex gap-2">
            {websiteUrl && (
              <Button asChild>
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                  {dict.tools.detail.visitWebsite}
                </a>
              </Button>
            )}
            {githubUrl && (
              <Button variant="outline" asChild>
                <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Overview Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{dict.tools.detail.overview}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">{dict.tools.detail.description}</h3>
            <p className="text-muted-foreground">
              {description || tagline || dict.tools.defaultDescription}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{dict.tools.detail.company}</p>
              <p className="font-medium">{company.name || dict.common.notAvailable}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{dict.tools.detail.pricing}</p>
              <p className="font-medium">{pricingModel || dict.common.notAvailable}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tool Detail Tabs */}
      <ToolDetailTabs tool={tool} dict={dict} />

      {/* Mobile Visit Site button - centered below content */}
      <div className="mt-8 flex flex-col items-center gap-3 md:hidden">
        {websiteUrl && (
          <Button asChild size="lg" className="w-full max-w-xs">
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
              {dict.tools.detail.visitWebsite}
            </a>
          </Button>
        )}
        {githubUrl && (
          <Button variant="outline" asChild size="lg" className="w-full max-w-xs">
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              {dict.tools.detail.viewGithub}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
