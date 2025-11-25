"use client";

import { Archive, ArrowLeft, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

interface ArchiveSummary {
  period: string;
  periodFormatted: string;
  excerpt: string;
  generatedAt: string;
}

interface WhatsNewArchiveProps {
  summaries: ArchiveSummary[];
  dict: Dictionary;
  lang: Locale;
}

export default function WhatsNewArchive({
  summaries,
  dict,
  lang,
}: WhatsNewArchiveProps): React.JSX.Element {
  // Group summaries by year
  const summariesByYear = summaries.reduce((acc, summary) => {
    const year = summary.period.split("-")[0];
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(summary);
    return acc;
  }, {} as Record<string, ArchiveSummary[]>);

  // Sort years in descending order
  const years = Object.keys(summariesByYear).sort((a, b) => Number(b) - Number(a));

  // Track expanded years (default: latest year expanded)
  const [expandedYears, setExpandedYears] = useState<Set<string>>(
    new Set(years.length > 0 ? [years[0]] : [])
  );

  const toggleYear = (year: string) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/${lang}/whats-new`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Latest
          </Link>
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <Archive className="h-8 w-8 text-primary" />
          <h1 className="text-3xl md:text-4xl font-bold">What's New Archive</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Browse all monthly summaries of AI coding tool updates and industry news.
        </p>
      </div>

      {/* Empty State */}
      {summaries.length === 0 && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground mb-4">
              No monthly summaries available yet.
            </p>
            <Button variant="outline" asChild>
              <Link href={`/${lang}/news`}>Browse News Articles</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summaries Grouped by Year */}
      {years.map((year) => {
        const isExpanded = expandedYears.has(year);
        const yearSummaries = summariesByYear[year];

        return (
          <Card key={year} className="mb-4">
            <CardHeader
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleYear(year)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl">{year}</CardTitle>
                  <Badge variant="secondary">
                    {yearSummaries.length} report{yearSummaries.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent>
                <div className="space-y-4">
                  {yearSummaries.map((summary) => (
                    <Link
                      key={summary.period}
                      href={`/${lang}/whats-new/${summary.period}`}
                      className="block"
                    >
                      <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <CardTitle className="text-lg mb-2">
                                {summary.periodFormatted}
                              </CardTitle>
                              <CardDescription className="line-clamp-2">
                                {summary.excerpt}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap">
                              <Calendar className="h-4 w-4" />
                              {formatDate(summary.generatedAt)}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Footer */}
      {summaries.length > 0 && (
        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link href={`/${lang}/whats-new`}>View Latest Report</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
