import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, TrendingUp, Star } from "lucide-react";
import Link from "next/link";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "What's New - AI Power Rankings",
    description: "Latest updates and changes to the AI Power Rankings platform",
  };
}

export default async function UpdatesPage({ params }: PageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href={`/${lang}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {dict.common.backToHome}
            </Link>
          </Button>

          <div className="flex items-center gap-4 mb-4">
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Calendar className="h-3 w-3 mr-1" />
              June 17, 2025
            </Badge>
          </div>

          <h1 className="text-4xl font-bold mb-4">What&apos;s New</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Latest updates, new articles, and ranking changes in the AI Power Rankings platform.
          </p>
        </div>

        {/* Latest Update */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Latest Ranking Update
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* New Articles */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📰 New Articles Processed</h3>
              <div className="space-y-3">
                <div className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">
                        OpenAI Launches $200 ChatGPT Pro with Unlimited O1 Access and Canvas
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        <Badge variant="secondary" className="mr-2">
                          Product Launch
                        </Badge>
                        Affects: ChatGPT Canvas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">
                        OpenAI Rewrites Codex CLI in Rust for Enhanced Performance and Security
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        <Badge variant="secondary" className="mr-2">
                          Technical Achievement
                        </Badge>
                        Affects: OpenAI Codex CLI
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">
                        Augment Code Becomes First AI Coding Assistant to Achieve ISO/IEC 42001
                        Certification
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        <Badge variant="secondary" className="mr-2">
                          Technical Achievement
                        </Badge>
                        Affects: Augment Code
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Ranking Changes */}
            <div>
              <h3 className="text-lg font-semibold mb-3">🏆 Top 10 Current Rankings</h3>
              <div className="grid gap-2">
                {[
                  { rank: 1, name: "Cursor", score: 110.4, change: "+15", tier: "S" },
                  { rank: 2, name: "Devin", score: 99.9, change: "—", tier: "S" },
                  { rank: 3, name: "Claude Code", score: 86.1, change: "—", tier: "S" },
                  { rank: 4, name: "Google Jules", score: 81.2, change: "—", tier: "S" },
                  { rank: 5, name: "GitHub Copilot", score: 80.0, change: "—", tier: "S" },
                  { rank: 6, name: "Lovable", score: 76.1, change: "+24", tier: "A" },
                  { rank: 7, name: "ChatGPT Canvas", score: 70.0, change: "NEW", tier: "A" },
                  { rank: 8, name: "Windsurf", score: 69.1, change: "—", tier: "A" },
                  { rank: 9, name: "Bolt.new", score: 67.5, change: "+22", tier: "A" },
                  { rank: 10, name: "OpenAI Codex CLI", score: 64.8, change: "NEW", tier: "A" },
                ].map((tool) => (
                  <div
                    key={tool.rank}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                      >
                        {tool.rank}
                      </Badge>
                      <span className="font-medium">{tool.name}</span>
                      <Badge variant={tool.tier === "S" ? "default" : "secondary"}>
                        {tool.tier}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{tool.score}</span>
                      {tool.change !== "—" && (
                        <Badge
                          variant={tool.change === "NEW" ? "default" : "secondary"}
                          className={
                            tool.change === "NEW"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }
                        >
                          {tool.change}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📊 Impact Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">3</div>
                  <div className="text-sm text-muted-foreground">New Articles</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">19/39</div>
                  <div className="text-sm text-muted-foreground">Tools with News</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">38.3</div>
                  <div className="text-sm text-muted-foreground">Avg News Boost</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">227.9</div>
                  <div className="text-sm text-muted-foreground">Max Impact</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Algorithm Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Algorithm Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">News Impact Integration (v6-news)</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• 70% base score + 30% news impact weighting</li>
                  <li>• Exponential news aging over 12 months</li>
                  <li>• Category-specific impact multipliers</li>
                  <li>• Company announcement discount (0.7x)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Impact Categories</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <Badge variant="secondary" className="mr-2">
                      25x
                    </Badge>
                    Funding Announcements
                  </div>
                  <div>
                    <Badge variant="secondary" className="mr-2">
                      20x
                    </Badge>
                    Acquisitions
                  </div>
                  <div>
                    <Badge variant="secondary" className="mr-2">
                      15x
                    </Badge>
                    Product Launches
                  </div>
                  <div>
                    <Badge variant="secondary" className="mr-2">
                      10x
                    </Badge>
                    Technical Achievements
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
