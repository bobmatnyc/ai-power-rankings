"use client";

import {
  ArrowLeft,
  Award,
  Calendar,
  DollarSign,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Newspaper,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToolIcon } from "@/components/ui/tool-icon";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import ArticleScoringImpact from "./article-scoring-impact";

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  published_date: string;
  source?: string;
  source_url?: string;
  tags?: string[];
  tool_mentions?: string[];
  created_at: string;
  updated_at: string;
}

interface Tool {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category?: string;
  info?: {
    website?: string;
  };
}

interface NewsDetailContentProps {
  article: NewsArticle;
  tool: Tool | null;
  dict: Dictionary;
  lang: Locale;
}

interface ToolMention {
  id: string;
  slug: string;
  name: string;
  website?: string;
}

export default function NewsDetailContent({
  article,
  tool,
  dict,
  lang,
}: NewsDetailContentProps): React.JSX.Element {
  const [toolMentions, setToolMentions] = useState<ToolMention[]>([]);

  useEffect(() => {
    // Fetch tool information for mentions
    const fetchToolMentions = async () => {
      if (!article.tool_mentions || article.tool_mentions.length === 0) {
        return;
      }

      try {
        const response = await fetch("/api/tools/json");
        if (!response.ok) {
          throw new Error("Failed to fetch tools");
        }

        const allTools = await response.json();
        const mentions: ToolMention[] = [];

        for (const mention of article.tool_mentions.slice(0, 5)) {
          let foundTool = null;

          // Check if it's an ID (numeric string) or a name
          if (/^\d+$/.test(mention)) {
            // It's an ID, find by ID
            foundTool = allTools.find((t: Tool) => t.id === mention);
          } else {
            // It's a name, find by name or slug
            foundTool = allTools.find(
              (t: Tool) =>
                t.name.toLowerCase() === mention.toLowerCase() ||
                t.slug === mention.toLowerCase().replace(/\s+/g, "-")
            );
          }

          if (foundTool) {
            mentions.push({
              id: foundTool.id,
              slug: foundTool.slug,
              name: foundTool.name,
              website: foundTool.info?.website,
            });
          }
        }

        setToolMentions(mentions);
      } catch (error) {
        console.error("Failed to fetch tool mentions:", error);
      }
    };

    fetchToolMentions();
  }, [article.tool_mentions]);
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }
    
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getSourceIcon = (sourceName: string): React.JSX.Element => {
    const source = sourceName?.toLowerCase() || "";
    if (source.includes("github") || source.includes("git")) {
      return <GitBranch className="h-4 w-4" />;
    } else if (
      source.includes("news") ||
      source.includes("techcrunch") ||
      source.includes("verge")
    ) {
      return <Newspaper className="h-4 w-4" />;
    } else if (source.includes("blog") || source.includes("medium")) {
      return <FileText className="h-4 w-4" />;
    } else if (source.includes("twitter") || source.includes("x.com")) {
      return <Globe className="h-4 w-4" />;
    }
    return <ExternalLink className="h-4 w-4" />;
  };

  // Parse content for ranking-relevant quantitative metrics
  const extractMetrics = (content: string) => {
    const metrics: Array<{
      type: string;
      value: string;
      label: string;
      icon: string;
      color: string;
    }> = [];
    const text = content.toLowerCase();

    // Extract SWE-bench scores (key benchmark for our rankings)
    const sweScores = content.match(/(\d+\.?\d*)%.*swe-bench|swe-bench.*?(\d+\.?\d*)%/gi);
    if (sweScores) {
      sweScores.forEach((match) => {
        const score = match.match(/\d+\.?\d*%/)?.[0];
        if (score) {
          metrics.push({
            type: "benchmark",
            value: score,
            label: "SWE-bench Performance",
            icon: "trending-up",
            color: "text-primary",
          });
        }
      });
    }

    // Extract ARR/revenue (business performance metric)
    const revenue = content.match(
      /\$\d+\.?\d*\s*[MBK]?\s*ARR|\$\d+\.?\d*\s*(million|billion).*ARR/gi
    );
    if (revenue) {
      revenue.forEach((r) => {
        const amount = r.match(/\$[\d.,]+\s*[MBK]?|\$\d+\.?\d*\s*(million|billion)/i)?.[0];
        if (amount) {
          metrics.push({
            type: "revenue",
            value: amount,
            label: "Annual Recurring Revenue",
            icon: "dollar-sign",
            color: "text-green-600",
          });
        }
      });
    }

    // Extract funding/valuation (company growth indicator)
    const valuation = content.match(
      /\$\d+\.?\d*\s*(billion|million).*valuation|valuation.*\$\d+\.?\d*\s*(billion|million)/gi
    );
    if (valuation) {
      valuation.forEach((v) => {
        const amount = v.match(/\$[\d.,]+\s*(billion|million)/i)?.[0];
        if (amount) {
          metrics.push({
            type: "valuation",
            value: amount,
            label: "Company Valuation",
            icon: "award",
            color: "text-purple-600",
          });
        }
      });
    }

    // Extract user/customer counts (adoption metric)
    const users = content.match(
      /(\d+\.?\d*)\s*(million|thousand|K|M)\s*(users|customers|paying\s+customers|developers)/gi
    );
    if (users) {
      users.forEach((u) => {
        if (text.includes("paying") && u.toLowerCase().includes("customer")) {
          metrics.push({
            type: "customers",
            value: u,
            label: "Paying Customers",
            icon: "users",
            color: "text-orange-600",
          });
        } else {
          metrics.push({
            type: "users",
            value: u,
            label: "Total Users",
            icon: "users",
            color: "text-blue-600",
          });
        }
      });
    }

    // Extract context window size (technical capability)
    const contextWindow = content.match(
      /(\d+[,.]?\d*[KM]?)\s*tokens|context.*?(\d+[,.]?\d*[KM]?)/gi
    );
    if (contextWindow) {
      contextWindow.forEach((c) => {
        const tokens = c.match(/\d+[,.]?\d*[KM]?/)?.[0];
        if (tokens && parseInt(tokens.replace(/[,KM]/g, "")) > 1000) {
          metrics.push({
            type: "technical",
            value: `${tokens} tokens`,
            label: "Context Window",
            icon: "code",
            color: "text-indigo-600",
          });
        }
      });
    }

    return metrics.slice(0, 4); // Limit to most important metrics
  };

  const metrics = extractMetrics(article.content);

  // Generate scoring factors for detail view (similar to API logic)
  const generateDetailScoringFactors = (article: NewsArticle) => {
    const factors: any = {};
    const titleLower = article.title.toLowerCase();
    const eventType = getEventType(article);
    const importance = calculateImportanceScore(article);

    // Enhanced impact magnitude calculation
    const baseMagnitude = Math.max(0.1, (importance - 4) / 5);

    // Add bonus multipliers for high-impact keywords
    let multiplier = 1;
    if (titleLower.includes("breakthrough") || titleLower.includes("revolutionary")) {
      multiplier = 1.5;
    }
    if (titleLower.includes("million") || titleLower.includes("billion")) {
      multiplier = 1.3;
    }
    if (titleLower.includes("launches") || titleLower.includes("announces")) {
      multiplier = 1.2;
    }

    switch (eventType) {
      case "milestone":
        if (titleLower.includes("funding") || titleLower.includes("raised")) {
          factors.market_traction = baseMagnitude * 2 * multiplier;
          factors.business_sentiment = baseMagnitude * 1.5 * multiplier;
          factors.development_velocity = baseMagnitude * 0.5 * multiplier;
        }
        break;
      case "feature":
        if (titleLower.includes("ai") || titleLower.includes("autonomous")) {
          factors.agentic_capability = baseMagnitude * 2 * multiplier;
          factors.innovation = baseMagnitude * 1.5 * multiplier;
        }
        if (titleLower.includes("performance") || titleLower.includes("faster")) {
          factors.technical_performance = baseMagnitude * 1.8 * multiplier;
        }
        if (titleLower.includes("integration") || titleLower.includes("multi")) {
          factors.platform_resilience = baseMagnitude * 1.2 * multiplier;
        }
        break;
      case "partnership":
        factors.business_sentiment = baseMagnitude * 1.3 * multiplier;
        factors.market_traction = baseMagnitude * 1.0 * multiplier;
        factors.platform_resilience = baseMagnitude * 0.8 * multiplier;
        break;
      case "update":
        factors.development_velocity = baseMagnitude * 1.5 * multiplier;
        if (titleLower.includes("users") || titleLower.includes("community")) {
          factors.developer_adoption = baseMagnitude * 1.2 * multiplier;
        }
        break;
      case "announcement":
        factors.business_sentiment = baseMagnitude * 1.0 * multiplier;
        break;
    }

    // Round factors to 1 decimal place and filter out zeros
    const filteredFactors: any = {};
    Object.entries(factors).forEach(([key, value]) => {
      const rounded = Math.round((value as number) * 10) / 10;
      if (Math.abs(rounded) >= 0.1) {
        filteredFactors[key] = rounded;
      }
    });

    // If no factors generated, add some default ones for testing/display purposes
    if (Object.keys(filteredFactors).length === 0) {
      // Based on event type, add minimal default factors
      if (titleLower.includes("launch") || titleLower.includes("release")) {
        filteredFactors.innovation = 0.3;
        filteredFactors.development_velocity = 0.2;
      } else if (titleLower.includes("update") || titleLower.includes("improvement")) {
        filteredFactors.development_velocity = 0.2;
      } else {
        // General news article - minimal business sentiment impact
        filteredFactors.business_sentiment = 0.1;
      }
    }

    return filteredFactors;
  };

  // Calculate importance score for the article
  const calculateImportanceScore = (article: NewsArticle): number => {
    let importance = 5; // default
    const titleLower = article.title.toLowerCase();

    // Boost importance for high-impact keywords
    if (
      titleLower.includes("funding") ||
      titleLower.includes("raised") ||
      titleLower.includes("million")
    ) {
      importance = Math.min(10, importance + 2);
    }
    if (titleLower.includes("breakthrough") || titleLower.includes("revolutionary")) {
      importance = Math.min(10, importance + 3);
    }
    if (titleLower.includes("launches") || titleLower.includes("announces")) {
      importance = Math.min(10, importance + 1);
    }
    if (titleLower.includes("ai") && titleLower.includes("autonomous")) {
      importance = Math.min(10, importance + 2);
    }

    return importance;
  };

  // Determine event type from article data
  const getEventType = (article: NewsArticle): string => {
    let eventType = "update";

    // Check tags first for better categorization
    if (article.tags && article.tags.length > 0) {
      const tagStr = article.tags.join(" ").toLowerCase();
      if (
        tagStr.includes("launch") ||
        tagStr.includes("beta") ||
        tagStr.includes("general-availability")
      ) {
        eventType = "feature";
      } else if (
        tagStr.includes("milestone") ||
        tagStr.includes("revenue") ||
        tagStr.includes("funding") ||
        tagStr.includes("growth")
      ) {
        eventType = "milestone";
      } else if (tagStr.includes("benchmark") || tagStr.includes("performance")) {
        eventType = "feature";
      } else if (tagStr.includes("rebrand") || tagStr.includes("acquisition")) {
        eventType = "announcement";
      }
    }

    // Fallback to content analysis
    if (eventType === "update") {
      const text = `${article.title} ${article.summary || article.content || ""}`.toLowerCase();

      if (
        text.includes("funding") ||
        text.includes("raised") ||
        text.includes("investment") ||
        text.includes("valuation") ||
        text.includes("arr")
      ) {
        eventType = "milestone";
      } else if (
        text.includes("launch") ||
        text.includes("released") ||
        text.includes("feature") ||
        text.includes("introduces")
      ) {
        eventType = "feature";
      } else if (
        text.includes("partnership") ||
        text.includes("acquired") ||
        text.includes("acquisition")
      ) {
        eventType = "partnership";
      } else if (
        text.includes("hiring") ||
        text.includes("ceo") ||
        text.includes("leadership") ||
        text.includes("rebrand")
      ) {
        eventType = "announcement";
      }
    }

    return eventType;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link href={`/${lang}/news`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {dict.common?.back || "Back to News"}
        </Link>
      </Button>

      {/* Article Header */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-start gap-4 mb-4">
            {tool && (
              <ToolIcon
                name={tool.name}
                domain={tool.info?.website}
                size={64}
                className="flex-shrink-0"
                context="news"
              />
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-3">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(article.published_date)}
                </div>
                {article.source && (
                  <div className="flex items-center gap-1">
                    {getSourceIcon(article.source)}
                    {article.source}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="capitalize">
                    {article.tags?.find((tag) =>
                      ["milestone", "feature", "partnership", "update", "announcement"].includes(
                        tag
                      )
                    ) || "update"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tags and Tool Info */}
          <div className="flex flex-col gap-3">
            {/* Tool Information */}
            {tool && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Related Tool:</span>
                <Badge variant="outline" className="flex items-center gap-1">
                  <ToolIcon
                    name={tool.name}
                    domain={tool.info?.website}
                    size={16}
                    className="flex-shrink-0"
                    context="news"
                  />
                  {tool.name}
                </Badge>
              </div>
            )}

            {/* Additional tool mentions */}
            {toolMentions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Tools Mentioned:</span>
                {toolMentions.map((mention) => (
                  <Link key={mention.id} href={`/${lang}/tools/${mention.slug}`}>
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1 text-xs hover:bg-secondary/80 cursor-pointer"
                    >
                      <ToolIcon
                        name={mention.name}
                        domain={mention.website}
                        size={12}
                        className="flex-shrink-0"
                        context="news"
                      />
                      {mention.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {article.tags
                  .filter(
                    (tag) =>
                      !/^\d+$/.test(tag) &&
                      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
                        tag
                      ) &&
                      tag.trim()
                  )
                  .map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Summary - show only if different from content */}
          {article.summary &&
            article.summary !== article.content &&
            !article.content.includes(article.summary.substring(0, 50)) && (
              <>
                <CardDescription className="text-lg mb-6">{article.summary}</CardDescription>
                <Separator className="my-6" />
              </>
            )}

          {/* Main Content - if no summary or summary is same as content */}
          {(!article.summary ||
            article.summary === article.content ||
            article.content.includes(article.summary.substring(0, 50))) && (
            <div className="prose prose-lg dark:prose-invert max-w-none mb-6">
              <p className="whitespace-pre-wrap">{article.content}</p>
            </div>
          )}

          {/* Ranking Impact Scoring */}
          <Separator className="my-6" />
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">AI Power Rankings Impact</h3>
            <ArticleScoringImpact
              scoring_factors={generateDetailScoringFactors(article)}
              importance_score={calculateImportanceScore(article)}
              event_type={getEventType(article)}
              compact={false}
            />
          </div>

          {/* Ranking-Relevant Metrics */}
          {metrics.length > 0 && (
            <>
              <Separator className="my-6" />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Quantitative Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {metrics.map((metric, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                    >
                      {metric.icon === "trending-up" && (
                        <TrendingUp className={`h-4 w-4 ${metric.color}`} />
                      )}
                      {metric.icon === "dollar-sign" && (
                        <DollarSign className={`h-4 w-4 ${metric.color}`} />
                      )}
                      {metric.icon === "award" && <Award className={`h-4 w-4 ${metric.color}`} />}
                      {metric.icon === "users" && <Users className={`h-4 w-4 ${metric.color}`} />}
                      {metric.icon === "code" && <Sparkles className={`h-4 w-4 ${metric.color}`} />}
                      <div>
                        <p className="font-medium text-sm">{metric.value}</p>
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* External Links */}
          <Separator className="my-6" />
          <div className="flex flex-wrap gap-4">
            {article.source_url && (
              <Button variant="outline" asChild>
                <a href={article.source_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {dict.news?.viewSource || "View Source"}
                </a>
              </Button>
            )}
            {tool && (
              <Button variant="outline" asChild>
                <Link href={`/${lang}/tools/${tool.slug}`}>
                  {dict.news?.viewTool || "View Tool Details"}
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Link>
              </Button>
            )}
          </div>

          {/* AI Analysis Note */}
          <Card className="mt-6 bg-muted/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> This analysis was compiled by AI Power Rankings based on
                publicly available information. Metrics and insights are extracted to provide
                quantitative context for tracking AI tool developments.
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
