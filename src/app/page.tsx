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
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              AI Power Rankings
            </h1>
            <p className="mb-8 text-xl text-muted-foreground md:text-2xl">
              Data-driven rankings of AI coding tools using Algorithm v6.0 with innovation decay,
              platform risk modifiers, and revenue quality adjustments
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
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
          <h2 className="mb-8 text-center text-3xl font-bold">Top 3 AI Coding Tools</h2>

          {loading ? (
            <div className="text-center text-muted-foreground">Loading rankings...</div>
          ) : (
            <div className="space-y-6">
              {topRankings.map((ranking) => (
                <Card key={ranking.tool.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                          <span className="text-3xl">{getMedal(ranking.rank)}</span>
                          <Link href={`/tools/${ranking.tool.id}`} className="hover:underline">
                            {ranking.tool.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          <Badge variant="secondary" className="mr-2">
                            {ranking.tool.category.replace("-", " ")}
                          </Badge>
                          Overall Score:{" "}
                          {ranking.scores?.overall ? `${ranking.scores.overall.toFixed(2)}/10` : ""}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Agentic Capability</p>
                        <p className="text-lg font-semibold">
                          {ranking.scores?.agentic_capability
                            ? `${ranking.scores.agentic_capability.toFixed(1)}/10`
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Innovation Score</p>
                        <p className="text-lg font-semibold">
                          {ranking.scores?.innovation
                            ? `${ranking.scores.innovation.toFixed(1)}/10`
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Key Metric</p>
                        <p className="text-lg font-semibold">
                          {ranking.metrics.users
                            ? formatMetric(ranking.metrics.users, "users")
                            : ranking.metrics.monthly_arr
                              ? formatMetric(ranking.metrics.monthly_arr, "arr")
                              : ranking.metrics.swe_bench_score
                                ? formatMetric(ranking.metrics.swe_bench_score, "percentage")
                                : "-"}
                        </p>
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
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold">Stay Updated</h2>
            <p className="mb-6 text-muted-foreground">
              Get weekly updates on AI coding tool rankings and industry insights
            </p>
            <form className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-sm"
              />
              <Button type="submit">Subscribe</Button>
            </form>
          </div>
        </div>
      </section>

      {/* Methodology Brief */}
      <section id="methodology" className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-bold">Our Methodology</h2>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Algorithm v6.0</CardTitle>
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

            <Card>
              <CardHeader>
                <CardTitle>Key Modifiers</CardTitle>
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

      {/* Social Proof */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-3xl font-bold">Trusted by the Community</h2>

            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="mb-4 text-muted-foreground">
                    &quot;The most comprehensive and fair ranking system for AI coding tools
                    I&apos;ve seen. The innovation decay modifier is brilliant.&quot;
                  </p>
                  <p className="text-sm font-semibold">- Senior Developer</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="mb-4 text-muted-foreground">
                    &quot;Finally, a ranking that considers platform independence and revenue
                    quality. This is what the industry needed.&quot;
                  </p>
                  <p className="text-sm font-semibold">- Tech Lead</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="mb-4 text-muted-foreground">
                    &quot;Algorithm v6.0&apos;s approach to weighing autonomous capabilities is spot
                    on. Great work on the methodology.&quot;
                  </p>
                  <p className="text-sm font-semibold">- AI Researcher</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              © 2025 AI Power Rankings. Data-driven insights for the AI coding revolution.
            </p>
            <div className="flex gap-4">
              <Link href="/rankings" className="text-sm hover:underline">
                Rankings
              </Link>
              <Link href="/methodology" className="text-sm hover:underline">
                Methodology
              </Link>
              <Link href="/about" className="text-sm hover:underline">
                About
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
