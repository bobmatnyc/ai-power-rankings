"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

function VerifyContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");

  const getContent = () => {
    if (status === "success") {
      return {
        icon: <CheckCircle className="h-16 w-16 text-green-500" />,
        title: "Email Verified!",
        description:
          "Your subscription has been confirmed. You'll receive our weekly updates starting this week.",
        buttonText: "Go to Homepage",
        buttonHref: "/",
      };
    }

    if (status === "already-verified") {
      return {
        icon: <AlertCircle className="h-16 w-16 text-blue-500" />,
        title: "Already Verified",
        description: "Your email is already verified. You're all set to receive our updates!",
        buttonText: "Go to Homepage",
        buttonHref: "/",
      };
    }

    // Error cases
    let errorMessage = "Something went wrong. Please try subscribing again.";

    if (error === "missing-token") {
      errorMessage = "Invalid verification link. Please check your email for the correct link.";
    } else if (error === "invalid-token") {
      errorMessage = "This verification link is invalid or has expired. Please subscribe again.";
    } else if (error === "verification-failed") {
      errorMessage = "We couldn't verify your email. Please try again or contact support.";
    }

    return {
      icon: <XCircle className="h-16 w-16 text-red-500" />,
      title: "Verification Failed",
      description: errorMessage,
      buttonText: "Try Again",
      buttonHref: "/about",
    };
  };

  const content = getContent();

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">{content.icon}</div>
          <CardTitle className="text-2xl">{content.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{content.description}</p>
          <div className="pt-4">
            <Button asChild>
              <Link href={content.buttonHref}>{content.buttonText}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewsletterVerifyPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="container mx-auto p-8 max-w-2xl">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
