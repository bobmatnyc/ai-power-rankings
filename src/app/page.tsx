"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowRight, Star, TrendingUp } from "lucide-react";
import { RankingCard } from "@/components/ranking/ranking-card";
import { HeroCard } from "@/components/ranking/hero-card";

interface RankingData {
  rank: number;
  tool: {
    id: string;
    name: string;
    category: string;
    status: string;
    website_url?: string;
    description?: string;
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
  const [trendingTools, setTrendingTools] = useState<RankingData[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async (): Promise<void> => {
    try {
      const response = await fetch("/api/rankings");
      const data = await response.json();
      const rankings = data.rankings;
      
      setTopRankings(rankings.slice(0, 3));
      // For now, simulate trending as the next 3 tools
      setTrendingTools(rankings.slice(3, 6));
      // And recently updated as the next 4
      setRecentlyUpdated(rankings.slice(6, 10));
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch rankings:", error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5" />
        
        <div className="relative px-6 py-12 mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Star className="h-3 w-3 mr-1" />
              Updated Weekly
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
              <img 
                src="/ai-power-ranking-icon.png" 
                alt="AI Power Rankings Icon" 
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
              />
              <span>AI <span className="text-gradient">Power Rankings</span></span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Discover and compare the most powerful AI coding tools. From autonomous agents to IDE assistants, 
              find the perfect AI companion for your development workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="gradient-primary text-white hover:opacity-90 transition-opacity" asChild>
                <Link href="/rankings">
                  Explore All Tools
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/rankings?sort=trending">
                  View Trending
                  <ArrowUp className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Top 3 Tools */}
          {loading ? (
            <div className="text-center text-muted-foreground mb-12">Loading rankings...</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {topRankings.map((ranking, index) => (
                <HeroCard key={ranking.tool.id} ranking={ranking} index={index} />
              ))}
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">25</div>
              <div className="text-sm text-muted-foreground">AI Tools Ranked</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary mb-1">
                {trendingTools.length}
              </div>
              <div className="text-sm text-muted-foreground">Trending Up</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">Weekly</div>
              <div className="text-sm text-muted-foreground">Updates</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground mb-1">100%</div>
              <div className="text-sm text-muted-foreground">Free Access</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Section */}
      <section className="px-6 py-12 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center">
                <TrendingUp className="h-8 w-8 mr-2 text-accent" />
                Trending This Week
              </h2>
              <p className="text-muted-foreground">
                AI tools gaining momentum and climbing the rankings
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/rankings?sort=trending">View All Trending</Link>
            </Button>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {trendingTools.map((tool, index) => (
              <div key={tool.tool.id} className="relative h-full">
                <div className="absolute -top-2 -right-2 z-10">
                  <Badge className="bg-accent text-white border-0 shadow-lg">
                    <ArrowUp className="h-3 w-3 mr-1" />
                    +{3 - index}
                  </Badge>
                </div>
                <div className="h-full">
                  <RankingCard ranking={tool} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recently Updated Section */}
      <section className="px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center">
                <Star className="h-8 w-8 mr-2 text-primary" />
                Recently Updated
              </h2>
              <p className="text-muted-foreground">
                Latest updates and new features from top AI tools
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/rankings">View All Rankings</Link>
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {recentlyUpdated.map((tool) => (
              <div key={tool.tool.id} className="h-full">
                <RankingCard ranking={tool} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Overview */}
      <section className="px-6 py-12 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
            Explore by Category
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-primary/20 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  Code Assistants
                  <Badge className="bg-primary/10 text-primary">8</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col h-full">
                <p className="text-sm text-muted-foreground flex-1">
                  AI-powered code completion and suggestions
                </p>
                <div className="pt-3 mt-auto">
                  <Button variant="ghost" size="sm" className="group-hover:text-primary w-full justify-start" asChild>
                    <Link href="/rankings?category=code-assistant">
                      Explore →
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-secondary/20 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  AI Editors
                  <Badge className="bg-secondary/10 text-secondary">6</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col h-full">
                <p className="text-sm text-muted-foreground flex-1">
                  Smart editors with AI integration
                </p>
                <div className="pt-3 mt-auto">
                  <Button variant="ghost" size="sm" className="group-hover:text-secondary w-full justify-start" asChild>
                    <Link href="/rankings?category=ai-editor">
                      Explore →
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-accent/20 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  App Builders
                  <Badge className="bg-accent/10 text-accent">2</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col h-full">
                <p className="text-sm text-muted-foreground flex-1">
                  Build complete applications with AI assistance
                </p>
                <div className="pt-3 mt-auto">
                  <Button variant="ghost" size="sm" className="group-hover:text-accent w-full justify-start" asChild>
                    <Link href="/rankings?category=app-builder">
                      Explore →
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-destructive/20 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  Autonomous Agents
                  <Badge className="bg-destructive/10 text-destructive">3</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col h-full">
                <p className="text-sm text-muted-foreground flex-1">
                  Fully autonomous AI software engineers
                </p>
                <div className="pt-3 mt-auto">
                  <Button variant="ghost" size="sm" className="group-hover:text-destructive w-full justify-start" asChild>
                    <Link href="/rankings?category=autonomous-agent">
                      Explore →
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                <Link href="/news" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  News
                </Link>
                <Link href="/tools" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Tools Directory
                </Link>
                <Link href="/methodology" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Methodology
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
