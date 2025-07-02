"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bot,
  Lightbulb,
  Zap,
  Users,
  TrendingUp,
  MessageCircle,
  Rocket,
  Shield,
  Plus,
  Minus,
} from "lucide-react";

interface ScoringFactorsData {
  agentic_capability?: number;
  innovation?: number;
  technical_performance?: number;
  developer_adoption?: number;
  market_traction?: number;
  business_sentiment?: number;
  development_velocity?: number;
  platform_resilience?: number;
}

interface ArticleScoringImpactProps {
  scoring_factors?: ScoringFactorsData;
  importance_score?: number;
  event_type: string;
  compact?: boolean;
}

interface ScoringFactor {
  key: keyof ScoringFactorsData;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

const SCORING_FACTORS: ScoringFactor[] = [
  {
    key: "agentic_capability",
    name: "Agentic",
    icon: Bot,
    color: "text-blue-600",
    description: "Multi-file editing, task planning, autonomous operation",
  },
  {
    key: "innovation",
    name: "Innovation",
    icon: Lightbulb,
    color: "text-yellow-600",
    description: "Breakthrough features, novel approaches",
  },
  {
    key: "technical_performance",
    name: "Technical",
    icon: Zap,
    color: "text-purple-600",
    description: "Performance benchmarks, technical capabilities",
  },
  {
    key: "developer_adoption",
    name: "Adoption",
    icon: Users,
    color: "text-green-600",
    description: "User growth, community engagement",
  },
  {
    key: "market_traction",
    name: "Market",
    icon: TrendingUp,
    color: "text-emerald-600",
    description: "Revenue, funding, business growth",
  },
  {
    key: "business_sentiment",
    name: "Sentiment",
    icon: MessageCircle,
    color: "text-indigo-600",
    description: "Market perception, competitive position",
  },
  {
    key: "development_velocity",
    name: "Velocity",
    icon: Rocket,
    color: "text-orange-600",
    description: "Release frequency, development speed",
  },
  {
    key: "platform_resilience",
    name: "Resilience",
    icon: Shield,
    color: "text-slate-600",
    description: "Independence, multi-provider support",
  },
];

export default function ArticleScoringImpact({
  scoring_factors,
  importance_score,
  event_type,
  compact = false,
}: ArticleScoringImpactProps): React.JSX.Element | null {
  // Don't render if no scoring data
  if (!scoring_factors && !importance_score) {
    return null;
  }

  const hasFactorImpacts = scoring_factors && Object.keys(scoring_factors).length > 0;
  const affectedFactors = hasFactorImpacts
    ? SCORING_FACTORS.filter((factor) => {
        const impact = scoring_factors![factor.key];
        return impact !== undefined && impact !== 0;
      })
    : [];

  const getImpactColor = (impact: number): string => {
    if (impact > 0) {
      return "text-green-600 bg-green-50 border-green-200";
    }
    if (impact < 0) {
      return "text-red-600 bg-red-50 border-red-200";
    }
    return "text-muted-foreground bg-muted border-muted";
  };

  const getImpactIcon = (impact: number): React.JSX.Element => {
    if (impact > 0) {
      return <Plus className="h-3 w-3" />;
    }
    if (impact < 0) {
      return <Minus className="h-3 w-3" />;
    }
    return <></>;
  };

  const formatImpact = (impact: number): string => {
    const abs = Math.abs(impact);
    if (abs >= 1) {
      return `${impact > 0 ? "+" : ""}${impact.toFixed(1)}`;
    }
    return `${impact > 0 ? "+" : ""}${(impact * 100).toFixed(0)}%`;
  };

  if (compact) {
    // Compact view for news feed cards
    return (
      <TooltipProvider>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {/* High importance indicator */}
          {importance_score && importance_score >= 7 && (
            <Badge variant="destructive" className="text-xs px-2 py-0.5">
              🔥 High Impact ({importance_score}/10)
            </Badge>
          )}

          {/* Factor impacts */}
          {hasFactorImpacts && affectedFactors.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Ranking Impact:</span>
              <div className="flex gap-1">
                {affectedFactors.slice(0, 4).map((factor) => {
                  const impact = scoring_factors![factor.key]!;
                  return (
                    <Tooltip key={factor.key}>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`text-xs px-2 py-1 cursor-help transition-all hover:scale-105 ${getImpactColor(impact)}`}
                        >
                          <factor.icon className="h-3 w-3 mr-1" />
                          <span className="font-medium">{factor.name}</span>
                          <span className="ml-1 text-xs">
                            {getImpactIcon(impact)}
                            {formatImpact(impact)}
                          </span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">
                            {factor.name} Impact: {formatImpact(impact)}
                          </p>
                          <p className="text-xs text-muted-foreground">{factor.description}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                {affectedFactors.length > 4 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs px-2 py-1 cursor-help">
                        +{affectedFactors.length - 4} more
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        {affectedFactors.slice(4).map((factor) => (
                          <div key={factor.key} className="text-xs">
                            {factor.name}: {formatImpact(scoring_factors![factor.key]!)}
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}

          {/* Show importance score for articles without factor impacts */}
          {!hasFactorImpacts && importance_score && importance_score > 5 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              📊 Impact Score: {importance_score}/10
            </Badge>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Detailed view for article pages
  return (
    <TooltipProvider>
      <Card className="border-l-4 border-l-primary/20">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Ranking Impact</h4>
              {importance_score && (
                <Badge variant="secondary" className="text-xs">
                  Importance: {importance_score}/10
                </Badge>
              )}
            </div>

            {hasFactorImpacts && affectedFactors.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {affectedFactors.map((factor) => {
                  const impact = scoring_factors![factor.key]!;
                  return (
                    <Tooltip key={factor.key}>
                      <TooltipTrigger asChild>
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg border ${getImpactColor(
                            impact
                          )} transition-colors hover:opacity-80 cursor-help`}
                        >
                          <factor.icon className="h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs truncate">{factor.name}</div>
                            <div className="flex items-center gap-1 text-xs">
                              {getImpactIcon(impact)}
                              <span>{formatImpact(impact)}</span>
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {factor.name}: {formatImpact(impact)}
                          </p>
                          <p className="text-xs text-muted-foreground">{factor.description}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No specific factor impacts identified for this {event_type}.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
