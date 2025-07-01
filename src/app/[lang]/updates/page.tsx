import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, TrendingUp, Star, AlertCircle } from "lucide-react";
import Link from "next/link";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { UpdatesGenerator } from "@/lib/updates-generator";
import { format } from "date-fns";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "What's New - AI Power Ranking",
    description: "Latest updates and changes to the AI Power Ranking platform",
  };
}

export default async function UpdatesPage({ params }: PageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  // Generate dynamic updates
  const generator = new UpdatesGenerator();
  let updates;

  try {
    updates = await generator.generateUpdates();
  } catch (error) {
    console.error("Failed to generate updates:", error);
    // Fallback to empty data
    updates = {
      lastUpdate: new Date().toISOString(),
      newArticles: [],
      topRankings: [],
      statistics: {
        newArticlesCount: 0,
        totalArticles: 0,
        toolsWithNews: 0,
        totalTools: 0,
        maxImpact: { toolName: "N/A", impact: 0 },
      },
      majorChanges: [],
    };
  }

  const formattedDate = format(new Date(updates.lastUpdate), "MMMM d, yyyy");

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
              {formattedDate}
            </Badge>
          </div>

          <h1 className="text-4xl font-bold mb-4">What&apos;s New</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Latest updates, new articles, and ranking changes in the AI Power Ranking platform.
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
            {updates.newArticles.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">📰 New Articles Processed</h3>
                <div className="space-y-3">
                  {updates.newArticles.map((article) => (
                    <Link
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium hover:text-primary transition-colors">
                            {article.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            <Badge variant="secondary" className="mr-2 capitalize">
                              {article.category.replace(/_/g, " ")}
                            </Badge>
                            {article.toolMentions.length > 0 && (
                              <span>Affects: {article.toolMentions.join(", ")}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Major Changes */}
            {updates.majorChanges.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Major Ranking Changes
                </h3>
                <div className="space-y-2">
                  {updates.majorChanges.map((change, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{change.toolName}</span>
                        <Badge
                          variant={change.changeCategory.includes("rise") ? "default" : "secondary"}
                          className={
                            change.changeCategory === "new_entry"
                              ? "bg-green-100 text-green-800"
                              : change.changeCategory.includes("rise")
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                          }
                        >
                          {change.changeCategory === "new_entry"
                            ? "NEW"
                            : change.currentRank < change.previousRank
                              ? `↑${change.previousRank - change.currentRank}`
                              : `↓${change.currentRank - change.previousRank}`}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{change.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Ranking Changes */}
            <div>
              <h3 className="text-lg font-semibold mb-3">🏆 Top 10 Current Rankings</h3>
              <div className="grid gap-2">
                {updates.topRankings.map((tool) => (
                  <Link
                    key={tool.rank}
                    href={`/${lang}/tools/${tool.slug}`}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                      >
                        {tool.rank}
                      </Badge>
                      <span className="font-medium hover:text-primary transition-colors">
                        {tool.toolName}
                      </span>
                      <Badge variant={tool.tier === "S" ? "default" : "secondary"}>
                        {tool.tier}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{tool.score.toFixed(1)}</span>
                      {tool.change !== "—" && (
                        <Badge
                          variant={tool.change === "NEW" ? "default" : "secondary"}
                          className={
                            tool.change === "NEW"
                              ? "bg-green-100 text-green-800"
                              : tool.changeType === "up"
                                ? "bg-green-100 text-green-800"
                                : tool.changeType === "down"
                                  ? "bg-red-100 text-red-800"
                                  : ""
                          }
                        >
                          {tool.change}
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📊 Impact Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{updates.statistics.newArticlesCount}</div>
                  <div className="text-sm text-muted-foreground">New Articles</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{updates.statistics.totalArticles}</div>
                  <div className="text-sm text-muted-foreground">Total Articles</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {updates.statistics.toolsWithNews}/{updates.statistics.totalTools}
                  </div>
                  <div className="text-sm text-muted-foreground">Tools with News</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {updates.statistics.maxImpact.impact.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Max Impact ({updates.statistics.maxImpact.toolName})
                  </div>
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
                  <li>• Logarithmic volume scaling for better distribution</li>
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
