"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface UnsubscribeContentProps {
  lang: Locale;
  dict: Dictionary;
}

export function UnsubscribeContent({ lang, dict }: UnsubscribeContentProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");

  const getContent = () => {
    if (status === "success") {
      return {
        icon: <CheckCircle className="h-16 w-16 text-green-500" />,
        title: dict.newsletter.unsubscribe.success.title,
        description: dict.newsletter.unsubscribe.success.description,
        buttonText: dict.newsletter.verify.goToHomepage,
        buttonHref: `/${lang}`,
      };
    }

    // Error cases
    let errorMessage = dict.newsletter.unsubscribe.errors.default;

    if (error === "missing-token") {
      errorMessage = dict.newsletter.unsubscribe.errors.missingToken;
    } else if (error === "invalid-token") {
      errorMessage = dict.newsletter.unsubscribe.errors.invalidToken;
    } else if (error === "unsubscribe-failed") {
      errorMessage = dict.newsletter.unsubscribe.errors.unsubscribeFailed;
    }

    return {
      icon: <XCircle className="h-16 w-16 text-red-500" />,
      title: dict.newsletter.unsubscribe.error.title,
      description: errorMessage,
      buttonText: dict.newsletter.verify.goToHomepage,
      buttonHref: `/${lang}`,
    };
  };

  const content = getContent();

  return (
    <div className="container mx-auto p-8 max-w-md">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">{content.icon}</div>
          <CardTitle className="text-2xl">{content.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">{content.description}</p>
          <Button asChild className="w-full">
            <Link href={content.buttonHref}>{content.buttonText}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
