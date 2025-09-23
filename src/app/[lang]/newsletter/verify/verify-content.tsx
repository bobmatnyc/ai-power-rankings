"use client";

import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

interface VerifyContentProps {
  lang: Locale;
  dict: Dictionary;
}

export function VerifyContent({ lang, dict }: VerifyContentProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");

  const getContent = () => {
    if (status === "success") {
      return {
        icon: <CheckCircle className="h-16 w-16 text-green-500" />,
        title: dict.newsletter.verify.success.title,
        description: dict.newsletter.verify.success.description,
        buttonText: dict.newsletter.verify.goToHomepage,
        buttonHref: `/${lang}`,
      };
    }

    if (status === "already-verified") {
      return {
        icon: <AlertCircle className="h-16 w-16 text-blue-500" />,
        title: dict.newsletter.verify.alreadyVerified.title,
        description: dict.newsletter.verify.alreadyVerified.description,
        buttonText: dict.newsletter.verify.goToHomepage,
        buttonHref: `/${lang}`,
      };
    }

    // Error cases
    let errorMessage = dict.newsletter.verify.errors.default;

    if (error === "missing-token") {
      errorMessage = dict.newsletter.verify.errors.missingToken;
    } else if (error === "invalid-token") {
      errorMessage = dict.newsletter.verify.errors.invalidToken;
    } else if (error === "verification-failed") {
      errorMessage = dict.newsletter.verify.errors.verificationFailed;
    }

    return {
      icon: <XCircle className="h-16 w-16 text-red-500" />,
      title: dict.newsletter.verify.error.title,
      description: errorMessage,
      buttonText: dict.newsletter.verify.tryAgain,
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
