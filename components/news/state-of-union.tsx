"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";

interface StateOfUnionProps {
  lang: Locale;
}

interface StateOfAiData {
  month: number;
  year: number;
  content: string;
  generatedAt: string;
}

/**
 * Format month number to name
 */
const formatMonthName = (month: number): string => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1] || "Unknown";
};

/**
 * Parse markdown content to JSX with link support
 * Simple parser for inline markdown links: [text](url)
 */
const parseMarkdownContent = (content: string): React.JSX.Element[] => {
  const paragraphs = content.split("\n\n").filter((p) => p.trim());

  return paragraphs.map((paragraph, idx) => {
    // Parse inline markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | React.JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(paragraph)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(paragraph.substring(lastIndex, match.index));
      }

      // Add the link
      parts.push(
        <a
          key={`link-${idx}-${match.index}`}
          href={match[2]}
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[1]}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last link
    if (lastIndex < paragraph.length) {
      parts.push(paragraph.substring(lastIndex));
    }

    return (
      <p key={`paragraph-${idx}`}>
        {parts.length > 0 ? parts : paragraph}
      </p>
    );
  });
};

export default function StateOfUnion({ lang }: StateOfUnionProps): React.JSX.Element {
  const [data, setData] = useState<StateOfAiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStateOfAi = async () => {
      try {
        const response = await fetch("/api/state-of-ai/current");

        if (!response.ok) {
          // If not found, show placeholder
          if (response.status === 404) {
            setError("No State of AI editorial available yet");
            return;
          }
          throw new Error("Failed to fetch State of AI editorial");
        }

        const result = await response.json();
        setData(result.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchStateOfAi();
  }, []);

  // Loading state
  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" />
            State of Agentic Coding
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state (show placeholder)
  if (error || !data) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" />
            State of Agentic Coding: October 2025
          </h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-muted-foreground">
            {/* Fallback to hardcoded content if API fails */}
            <p>
              The agentic coding market is experiencing a profound trust crisis despite widespread adoption. While
              84% of developers now use AI coding tools, recent surveys reveal only 33-46% actually trust these
              systems with their code—exposing a critical gap between usage and confidence.
            </p>
            <p>
              Market dynamics are reshaping rapidly. Replit&apos;s $150M ARR at $3B valuation demonstrates strong
              revenue potential, while Anthropic&apos;s Claude Sonnet 4.5 leads in agentic capability scores. The
              evolution from autocomplete to autonomous multi-file editing represents a fundamental shift in how
              developers interact with AI.
            </p>
            <p>
              However, significant challenges persist. GitHub Copilot&apos;s 36% failure rates on complex tasks
              highlight reliability concerns, while platform resilience remains a top worry. The Cursor vs Windsurf
              competition exemplifies how quickly market leadership can shift in this volatile space.
            </p>
            <p>
              Looking ahead, the industry is moving toward multi-model support, self-hosting options, and platform
              independence—addressing developers&apos; primary concerns about vendor lock-in and service disruptions.
              Tools that successfully balance powerful autonomous capabilities with transparency and reliability will
              likely emerge as long-term winners in this evolving landscape.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success state with dynamic content
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <TrendingUp className="h-5 w-5 text-primary" />
          State of Agentic Coding: {formatMonthName(data.month)} {data.year}
        </h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 text-muted-foreground">
          {parseMarkdownContent(data.content)}
        </div>
      </CardContent>
    </Card>
  );
}
