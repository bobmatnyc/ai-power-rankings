"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
interface MetricFactor {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  percentage: number;
  description: string;
  details: string;
  isPrimary: boolean;
}

export default function ScoringMetrics(): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  const metrics: MetricFactor[] = [
    // Primary Factors (87.5% total)
    {
      id: "agentic",
      icon: Bot,
      name: "Agentic Capability",
      percentage: 30,
      description: "Multi-file editing, task planning, autonomous operation",
      details:
        "Measures the tool's ability to work independently across multiple files, plan complex tasks, and operate autonomously with minimal human intervention. This includes code refactoring, debugging, and implementing features across codebases.",
      isPrimary: true,
    },
    {
      id: "innovation",
      icon: Lightbulb,
      name: "Innovation",
      percentage: 15,
      description: "Time-decayed innovation score, breakthrough features",
      details:
        "Evaluates cutting-edge features, novel approaches to coding assistance, and breakthrough capabilities that set tools apart. Recent innovations are weighted more heavily than older ones.",
      isPrimary: true,
    },
    {
      id: "technical",
      icon: Zap,
      name: "Technical Performance",
      percentage: 12.5,
      description: "SWE-bench scores, multi-file support, context window",
      details:
        "Objective technical metrics including performance on standardized benchmarks like SWE-bench, ability to handle large contexts, multi-file operations, and code quality metrics.",
      isPrimary: true,
    },
    {
      id: "adoption",
      icon: Users,
      name: "Developer Adoption",
      percentage: 12.5,
      description: "GitHub stars, active users, community engagement",
      details:
        "Measures real-world adoption through user counts, GitHub stars, community activity, developer satisfaction surveys, and ecosystem growth indicators.",
      isPrimary: true,
    },
    {
      id: "market",
      icon: TrendingUp,
      name: "Market Traction",
      percentage: 12.5,
      description: "Revenue, user growth, funding, valuation",
      details:
        "Business metrics including revenue growth, user acquisition rates, funding rounds, valuation changes, and market penetration in the developer tools space.",
      isPrimary: true,
    },
    {
      id: "sentiment",
      icon: MessageCircle,
      name: "Business Sentiment",
      percentage: 7.5,
      description: "Market perception, platform risks, competitive position",
      details:
        "Overall market sentiment, developer feedback, platform stability risks, competitive positioning, and long-term viability assessments from industry analysts and users.",
      isPrimary: true,
    },
    // Secondary Factors (12.5% total)
    {
      id: "velocity",
      icon: Rocket,
      name: "Development Velocity",
      percentage: 5,
      description: "Release frequency, contributor count, update cadence",
      details:
        "Rate of improvement and feature releases, number of active contributors, frequency of updates, and overall development momentum and responsiveness to user needs.",
      isPrimary: false,
    },
    {
      id: "resilience",
      icon: Shield,
      name: "Platform Resilience",
      percentage: 5,
      description: "Multi-model support, independence, self-hosting option",
      details:
        "Platform independence, support for multiple AI models, self-hosting capabilities, and resilience against vendor lock-in or service disruptions.",
      isPrimary: false,
    },
  ];

  const primaryFactors = metrics.filter((m) => m.isPrimary);
  const secondaryFactors = metrics.filter((m) => !m.isPrimary);

  const primaryTotal = primaryFactors.reduce((sum, m) => sum + m.percentage, 0);
  const secondaryTotal = secondaryFactors.reduce((sum, m) => sum + m.percentage, 0);

  return (
    <TooltipProvider>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Understanding Our Rankings
              </CardTitle>
              <CardDescription>
                Learn how we evaluate and rank AI coding tools based on 8 key factors
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2"
            >
              {isExpanded ? (
                <>
                  <span>Show Less</span>
                  <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Show Details</span>
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Primary Factors */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Primary Factors
              </h4>
              <Badge variant="secondary" className="text-xs">
                {primaryTotal}% Total Weight
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {primaryFactors.map((metric) => (
                <Tooltip key={metric.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-help">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                        <metric.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{metric.name}</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                            {metric.percentage}%
                          </Badge>
                        </div>
                        {!isExpanded && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {metric.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm">
                    <div className="space-y-2">
                      <p className="font-medium">
                        {metric.name} ({metric.percentage}%)
                      </p>
                      <p className="text-xs">{metric.details}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Secondary Factors */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Secondary Factors
              </h4>
              <Badge variant="outline" className="text-xs">
                {secondaryTotal}% Total Weight
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {secondaryFactors.map((metric) => (
                <Tooltip key={metric.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-help">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10">
                        <metric.icon className="h-4 w-4 text-secondary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{metric.name}</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                            {metric.percentage}%
                          </Badge>
                        </div>
                        {!isExpanded && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {metric.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm">
                    <div className="space-y-2">
                      <p className="font-medium">
                        {metric.name} ({metric.percentage}%)
                      </p>
                      <p className="text-xs">{metric.details}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <>
              <Separator className="my-6" />
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Detailed Factor Explanations
                </h4>

                <div className="space-y-4">
                  {metrics.map((metric) => (
                    <div key={metric.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-full ${
                            metric.isPrimary ? "bg-primary/10" : "bg-secondary/10"
                          }`}
                        >
                          <metric.icon
                            className={`h-5 w-5 ${
                              metric.isPrimary ? "text-primary" : "text-secondary-foreground"
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="font-semibold">{metric.name}</h5>
                            <Badge
                              variant={metric.isPrimary ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {metric.percentage}%
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{metric.description}</p>
                          <p className="text-sm">{metric.details}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Our ranking methodology combines these weighted factors
                    with real-time market data to provide the most accurate and current assessment
                    of AI coding tools. Rankings are updated monthly to reflect the rapidly evolving
                    landscape.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
