"use client";

import { Code2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewsletterModal } from "@/components/ui/newsletter-modal";
import { TechStackModal } from "@/components/ui/tech-stack-modal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

interface AboutContentProps {
  lang: Locale;
  dict: Dictionary;
}

export function AboutContent({ lang, dict }: AboutContentProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const [newsletterOpen, setNewsletterOpen] = useState(false);

  useEffect(() => {
    // Check if we should open the newsletter modal
    if (searchParams.get("subscribe") === "true") {
      setNewsletterOpen(true);
      // Clean up the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("subscribe");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams]);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{dict.about.title}</h1>
        <p className="text-muted-foreground text-lg">{dict.about.subtitle}</p>
      </div>

      {/* Mission */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{dict.about.mission.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-muted-foreground">{dict.about.mission.description}</p>
          <div className="mt-6">
            <Button onClick={() => setNewsletterOpen(true)}>
              {dict.navigation.subscribeToUpdates}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* What We Do */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{dict.about.whatWeDo.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">🔍 {dict.about.whatWeDo.analysis.title}</h3>
            <p className="text-sm text-muted-foreground">
              {dict.about.whatWeDo.analysis.description}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">📊 {dict.about.whatWeDo.methodology.title}</h3>
            <p className="text-sm text-muted-foreground">
              {dict.about.whatWeDo.methodology.description}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">🔄 {dict.about.whatWeDo.updates.title}</h3>
            <p className="text-sm text-muted-foreground">
              {dict.about.whatWeDo.updates.description}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">🌍 {dict.about.whatWeDo.community.title}</h3>
            <p className="text-sm text-muted-foreground">
              {dict.about.whatWeDo.community.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Why It Matters */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{dict.about.whyItMatters.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">{dict.about.whyItMatters.description}</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
            <li>
              <strong>{dict.about.whyItMatters.challenges.paralysis.title}:</strong>{" "}
              {dict.about.whyItMatters.challenges.paralysis.description}
            </li>
            <li>
              <strong>{dict.about.whyItMatters.challenges.marketing.title}:</strong>{" "}
              {dict.about.whyItMatters.challenges.marketing.description}
            </li>
            <li>
              <strong>{dict.about.whyItMatters.challenges.change.title}:</strong>{" "}
              {dict.about.whyItMatters.challenges.change.description}
            </li>
            <li>
              <strong>{dict.about.whyItMatters.challenges.risks.title}:</strong>{" "}
              {dict.about.whyItMatters.challenges.risks.description}
            </li>
          </ul>
          <p className="text-muted-foreground">{dict.about.whyItMatters.conclusion}</p>
        </CardContent>
      </Card>

      {/* Team */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{dict.about.team.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            {dict.about.team.description1.split("Bob Matsuoka").map((part, index) => {
              if (index === 0) {
                return part;
              }
              return (
                <span key={`bob-matsuoka-link-${part.slice(0, 10)}`}>
                  <a
                    href="https://matsuoka.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Bob Matsuoka
                  </a>
                  {part}
                </span>
              );
            })}
          </p>
          <p className="text-muted-foreground mb-4">
            {dict.about.team.description2.split("HyperDev").map((part, index) => {
              if (index === 0) {
                return part;
              }
              return (
                <span key={`hyperdev-link-${part.slice(0, 10)}`}>
                  <a
                    href="https://hyperdev.matsuoka.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {dict.about.team.hyperdevLink}
                  </a>
                  {part}
                </span>
              );
            })}
          </p>
          <p className="text-muted-foreground mb-4">{dict.about.team.description3}</p>
          <div className="flex flex-wrap gap-4">
            <TechStackModal>
              <Button variant="outline" className="gap-2">
                <Code2 className="h-4 w-4" />
                View Tech Stack
              </Button>
            </TechStackModal>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <Card>
        <CardHeader>
          <CardTitle>{dict.about.cta.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{dict.about.cta.description}</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild>
              <Link href={`/${lang}/rankings`}>{dict.about.cta.exploreButton}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/${lang}/methodology`}>{dict.about.cta.methodologyButton}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <NewsletterModal open={newsletterOpen} onOpenChange={setNewsletterOpen} />
    </div>
  );
}
