"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { NewsletterModal } from "@/components/ui/newsletter-modal";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

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
    <div className="container mx-auto p-8 max-w-4xl">
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
          <p className="text-muted-foreground mb-4">{dict.about.team.description1}</p>
          <p className="text-muted-foreground mb-4">{dict.about.team.description2}</p>
          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <Link href="/contact">{dict.about.team.reportIssue}</Link>
            </Button>
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
