"use client";

import type { LucideIcon } from "lucide-react";
import {
  Code,
  DollarSign,
  Heart,
  Minus,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface MetricImpact {
  factor: keyof RankingFactors;
  impact: "positive" | "negative" | "neutral";
  magnitude: "high" | "medium" | "low";
  value?: string | number;
  description: string;
  evidence: string[];
}

interface RankingFactors {
  marketTraction: string;
  technicalCapability: string;
  developerAdoption: string;
  developmentVelocity: string;
  platformResilience: string;
  communitySentiment: string;
}

interface MetricImpactDisplayProps {
  impacts: MetricImpact[];
  toolName?: string;
}

const factorIcons: Record<keyof RankingFactors, LucideIcon> = {
  marketTraction: DollarSign,
  technicalCapability: Code,
  developerAdoption: Users,
  developmentVelocity: Zap,
  platformResilience: Shield,
  communitySentiment: Heart,
};

const factorLabels: Record<keyof RankingFactors, string> = {
  marketTraction: "Market Traction",
  technicalCapability: "Technical Capability",
  developerAdoption: "Developer Adoption",
  developmentVelocity: "Development Velocity",
  platformResilience: "Platform Resilience",
  communitySentiment: "Community Sentiment",
};

const impactColors = {
  positive: {
    high: "text-ds-success-fixed-mid bg-ds-success-fixed-subtle border-ds-success-fixed-border",
    medium: "text-ds-success-solid bg-ds-success-fixed-subtle border-ds-success-fixed-border",
    low: "text-ds-success-fixed-soft bg-ds-success-fixed-subtle border-ds-success-fixed-border",
  },
  negative: {
    high: "text-ds-danger-fixed bg-ds-danger-fixed-subtle border-ds-danger-fixed-border",
    medium: "text-ds-danger-solid bg-ds-danger-fixed-subtle border-ds-danger-fixed-border",
    low: "text-ds-danger-fixed-soft bg-ds-danger-fixed-subtle border-ds-danger-fixed-border",
  },
  neutral: {
    high: "text-ds-text-paper-muted bg-ds-surface-paper-muted border-ds-border-paper",
    medium: "text-ds-text-paper-subtle bg-ds-surface-paper-muted border-ds-border-paper",
    low: "text-ds-text-paper-faint bg-ds-surface-paper-muted border-ds-border-paper",
  },
};

export default function MetricImpactDisplay({ impacts, toolName }: MetricImpactDisplayProps) {
  if (!impacts || impacts.length === 0) {
    return null;
  }

  const getImpactIcon = (impact: MetricImpact["impact"]) => {
    switch (impact) {
      case "positive":
        return TrendingUp;
      case "negative":
        return TrendingDown;
      default:
        return Minus;
    }
  };

  const getImpactScore = (impact: MetricImpact) => {
    const scoreMap = {
      positive: { high: 3, medium: 2, low: 1 },
      negative: { high: -3, medium: -2, low: -1 },
      neutral: { high: 0, medium: 0, low: 0 },
    };
    return scoreMap[impact.impact][impact.magnitude];
  };

  const overallScore = impacts.reduce((sum, impact) => sum + getImpactScore(impact), 0);
  const maxPossibleScore = impacts.length * 3;
  const scorePercentage = ((overallScore + maxPossibleScore) / (maxPossibleScore * 2)) * 100;

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Ranking Impact Analysis
            </CardTitle>
            <CardDescription>
              How this news affects {toolName ? `${toolName}'s` : "the tool's"} ranking factors
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Overall Impact</div>
            <div className="flex items-center gap-2 mt-1">
              {overallScore > 0 ? (
                <TrendingUp className="h-4 w-4 text-ds-success-fixed-mid" />
              ) : overallScore < 0 ? (
                <TrendingDown className="h-4 w-4 text-ds-danger-fixed" />
              ) : (
                <Minus className="h-4 w-4 text-ds-text-paper-muted" />
              )}
              <span
                className={`font-semibold ${
                  overallScore > 0
                    ? "text-ds-success-fixed-mid"
                    : overallScore < 0
                      ? "text-ds-danger-fixed"
                      : "text-ds-text-paper-muted"
                }`}
              >
                {overallScore > 0 ? "+" : ""}
                {overallScore}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Impact Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Negative</span>
            <span>Neutral</span>
            <span>Positive</span>
          </div>
          <Progress value={scorePercentage} className="h-2" />
        </div>

        {/* Individual Factor Impacts */}
        <div className="grid gap-4">
          {impacts.map((impact) => {
            const Icon = factorIcons[impact.factor];
            const ImpactIcon = getImpactIcon(impact.impact);
            const colorClass = impactColors[impact.impact][impact.magnitude];

            return (
              <div
                key={`impact-${impact.factor}`}
                className={`border rounded-lg p-4 ${colorClass}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="p-2 rounded-full bg-background">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{factorLabels[impact.factor]}</h4>
                      <div className="flex items-center gap-2">
                        <ImpactIcon className="h-4 w-4" />
                        <Badge variant="secondary" className="text-xs">
                          {impact.magnitude} impact
                        </Badge>
                        {impact.value && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {impact.value}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm">{impact.description}</p>
                    {impact.evidence.length > 0 && (
                      <div className="space-y-1 mt-2">
                        <p className="text-xs font-medium">Evidence:</p>
                        <ul className="text-xs space-y-0.5">
                          {impact.evidence.map((evidence, idx) => (
                            <li
                              key={`${impact.factor}-evidence-${idx}`}
                              className="flex items-start gap-1"
                            >
                              <span className="text-muted-foreground">•</span>
                              <span className="italic">{evidence}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation Note */}
        <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-lg">
          <p className="font-medium mb-1">How we calculate impact:</p>
          <p>
            Our AI analyzes news content to identify quantitative and qualitative changes that
            affect ranking factors. Impacts are based on reported metrics, feature announcements,
            business developments, and community signals extracted from the article.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
