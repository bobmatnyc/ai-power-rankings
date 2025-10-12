"use client";

import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";

interface StateOfUnionProps {
  lang: Locale;
}

export default function StateOfUnion({ lang }: StateOfUnionProps): React.JSX.Element {
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
          <p>
            The agentic coding market is experiencing a profound trust crisis despite widespread adoption. While{" "}
            <Link href="/en/news/developer-adoption-survey" className="text-primary hover:underline">
              84% of developers now use AI coding tools
            </Link>
            , recent surveys reveal only 33-46% actually trust these systems with their code—exposing a critical
            gap between usage and confidence.
          </p>
          <p>
            Market dynamics are reshaping rapidly. Replit's{" "}
            <Link href="/en/news/replit-150m-arr" className="text-primary hover:underline">
              $150M ARR at $3B valuation
            </Link>{" "}
            demonstrates strong revenue potential, while Anthropic's Claude Sonnet 4.5 leads in{" "}
            <Link href="/en/tools/claude-sonnet-4-5" className="text-primary hover:underline">
              agentic capability scores
            </Link>
            . The evolution from autocomplete to autonomous multi-file editing represents a fundamental shift in
            how developers interact with AI.
          </p>
          <p>
            However, significant challenges persist. GitHub Copilot's{" "}
            <Link href="/en/news/copilot-failure-rates" className="text-primary hover:underline">
              36% failure rates on complex tasks
            </Link>{" "}
            highlight reliability concerns, while platform resilience remains a top worry. The{" "}
            <Link href="/en/news/cursor-vs-windsurf-battle" className="text-primary hover:underline">
              Cursor vs Windsurf competition
            </Link>{" "}
            exemplifies how quickly market leadership can shift in this volatile space.
          </p>
          <p>
            Looking ahead, the industry is moving toward multi-model support, self-hosting options, and platform
            independence—addressing developers' primary concerns about vendor lock-in and service disruptions. Tools
            that successfully balance powerful autonomous capabilities with transparency and reliability will likely
            emerge as long-term winners in this evolving landscape.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
