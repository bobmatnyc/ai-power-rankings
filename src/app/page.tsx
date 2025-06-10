"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RankingData {
  rank: number;
  tool: {
    id: string;
    name: string;
    category: string;
    status: string;
  };
  scores: {
    overall: number;
    agentic_capability: number;
    innovation: number;
  };
  metrics: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
  };
}

export default function Home(): React.JSX.Element {
  const [topRankings, setTopRankings] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopRankings();
  }, []);

  const fetchTopRankings = async (): Promise<void> => {
    try {
      const response = await fetch("/api/rankings");
      const data = await response.json();
      setTopRankings(data.rankings.slice(0, 3));
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch rankings:", error);
      setLoading(false);
    }
  };

  const getMedal = (rank: number): string => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
  };

  const formatMetric = (value: number | undefined, type: string): string => {
    if (value === undefined || value === 0) {
      return "-";
    }

    switch (type) {
      case "users":
        return value >= 1000000
          ? `${(value / 1000000).toFixed(1)}M users`
          : `${(value / 1000).toFixed(0)}k users`;
      case "arr":
        return `$${(value / 1000000).toFixed(0)}M ARR`;
      case "percentage":
        return `${value.toFixed(1)}% SWE-bench`;
      default:
        return value.toFixed(1);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5" />
        
        <div className="relative container mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-4xl text-center animate-fade-in">
            <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              AI <span className="text-gradient">Power Rankings</span>
            </h1>
            <p className="mb-8 text-xl text-muted-foreground md:text-2xl">
              Data-driven rankings of AI coding tools using Algorithm v6.0 with innovation decay,
              platform risk modifiers, and revenue quality adjustments
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="gradient-primary hover:opacity-90 transition-opacity" asChild>
                <Link href="/rankings">View Full Rankings</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#methodology">Learn Methodology</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Top 3 Preview */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
              Current Leaders
            </Badge>
            <h2 className="text-3xl font-bold">Top 3 AI Coding Tools</h2>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground">Loading rankings...</div>
          ) : (
            <div className="space-y-6">
              {topRankings.map((ranking) => (
                <Card key={ranking.tool.id} className="group overflow-hidden hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/20 animate-scale-in">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-lg">{ranking.tool.name.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                            <Link href={`/tools/${ranking.tool.id}`} className="hover:underline">
                              {ranking.tool.name}
                            </Link>
                          </CardTitle>
                          <CardDescription className="text-sm text-muted-foreground">
                            {ranking.tool.category.replace("-", " ")}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                          <span className="text-2xl mr-1">{getMedal(ranking.rank)}</span>
                          #{ranking.rank}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-primary/10 text-primary">
                          {ranking.tool.category.replace("-", " ")}
                        </Badge>
                        {ranking.scores?.overall && (
                          <Badge variant="outline">
                            Score: {ranking.scores.overall.toFixed(1)}/10
                          </Badge>
                        )}
                        {ranking.metrics.swe_bench_score && (
                          <Badge variant="outline">
                            SWE-bench: {ranking.metrics.swe_bench_score.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span className="flex items-center space-x-1">
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                            <span>Agentic: {ranking.scores?.agentic_capability?.toFixed(1) || "-"}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <span className="w-2 h-2 bg-secondary rounded-full"></span>
                            <span>Innovation: {ranking.scores?.innovation?.toFixed(1) || "-"}</span>
                          </span>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/tools/${ranking.tool.id}`}>
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <Button asChild>
              <Link href="/rankings">See All Rankings →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              Weekly Updates
            </Badge>
            <h2 className="mb-4 text-3xl font-bold">Stay Ahead of the Curve</h2>
            <p className="mb-6 text-muted-foreground">
              Get weekly updates on AI coding tool rankings, new releases, and industry insights
            </p>
            <form className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex h-11 w-full rounded-md border border-input bg-background px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-sm"
              />
              <Button type="submit" size="lg" className="gradient-primary hover:opacity-90 transition-opacity">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Methodology Brief */}
      <section id="methodology" className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-bold">Our Methodology</h2>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-primary">Algorithm v6.0</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-muted-foreground">
                  Our advanced ranking algorithm considers 8 key factors with sophisticated
                  modifiers:
                </p>
                <ul className="space-y-2 text-sm">
                  <li>
                    • <strong>Agentic Capability (30%)</strong> - Autonomous coding abilities
                  </li>
                  <li>
                    • <strong>Innovation (15%)</strong> - With 6-month decay half-life
                  </li>
                  <li>
                    • <strong>Technical Performance (12.5%)</strong> - SWE-bench focus
                  </li>
                  <li>
                    • <strong>Market Traction (12.5%)</strong> - Revenue quality adjusted
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-secondary">Key Modifiers</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-muted-foreground">
                  Three sophisticated modifiers ensure fair and accurate rankings:
                </p>
                <ul className="space-y-2 text-sm">
                  <li>
                    • <strong>Innovation Decay</strong> - Recent innovations score higher
                  </li>
                  <li>
                    • <strong>Platform Risk</strong> - Independence bonuses, lock-in penalties
                  </li>
                  <li>
                    • <strong>Revenue Quality</strong> - Enterprise revenue weighted higher
                  </li>
                  <li>
                    • <strong>Data Validation</strong> - 80% completeness required
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <Button variant="outline" asChild>
              <Link href="/methodology">Read Full Methodology</Link>
            </Button>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <div>
                  <h3 className="font-bold">AI Power Rankings</h3>
                  <p className="text-xs text-muted-foreground">Data-driven insights for the AI revolution</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                Comprehensive rankings of AI coding tools using Algorithm v6.0 with innovation decay,
                platform risk modifiers, and revenue quality adjustments.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <div className="space-y-2">
                <Link href="/rankings" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Rankings
                </Link>
                <Link href="/methodology" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Methodology
                </Link>
                <Link href="/tools" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Tools Directory
                </Link>
                <Link href="/about" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  About
                </Link>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Categories</h4>
              <div className="space-y-2">
                <Link href="/rankings?category=code-assistant" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Code Assistants
                </Link>
                <Link href="/rankings?category=ai-editor" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  AI Editors
                </Link>
                <Link href="/rankings?category=code-review" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Code Review
                </Link>
                <Link href="/rankings?category=autonomous-agent" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Autonomous Agents
                </Link>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-border/50">
            <p className="text-center text-sm text-muted-foreground">
              © 2025 AI Power Rankings. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
