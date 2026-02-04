"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
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
 * Strip the first H1 header from content to avoid duplication with card header
 */
const stripFirstH1 = (content: string): string => {
  return content.replace(/^#\s+[^\n]+\n+/, "");
};

/**
 * Custom components for ReactMarkdown to apply Tailwind styling
 */
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-2xl font-bold text-foreground mb-4">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-lg font-medium text-foreground mt-4 mb-2">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-muted-foreground mb-4 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc ml-6 space-y-3 my-4">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal ml-6 space-y-3 my-4">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-muted-foreground">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="text-primary hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
  ),
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
        <div className="prose-container">
          <ReactMarkdown components={markdownComponents}>
            {stripFirstH1(data.content)}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
