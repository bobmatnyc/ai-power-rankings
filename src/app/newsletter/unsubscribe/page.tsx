"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";

export default function NewsletterUnsubscribePage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");

  const getContent = () => {
    if (status === "success") {
      return {
        icon: <CheckCircle className="h-16 w-16 text-green-500" />,
        title: "Successfully Unsubscribed",
        description: "You have been unsubscribed from the AI Power Rankings newsletter. We're sorry to see you go!",
        buttonText: "Go to Homepage",
        buttonHref: "/",
      };
    }

    // Error cases
    let errorMessage = "Something went wrong. Please try again.";
    
    if (error === "missing-token") {
      errorMessage = "Invalid unsubscribe link. Please use the link from your email.";
    } else if (error === "invalid-token") {
      errorMessage = "This unsubscribe link is invalid or has expired.";
    } else if (error === "unsubscribe-failed") {
      errorMessage = "We couldn't process your unsubscribe request. Please try again or contact support.";
    }

    return {
      icon: <XCircle className="h-16 w-16 text-red-500" />,
      title: "Unsubscribe Failed",
      description: errorMessage,
      buttonText: "Go to Homepage",
      buttonHref: "/",
    };
  };

  const content = getContent();

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {content.icon}
          </div>
          <CardTitle className="text-2xl">{content.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {content.description}
          </p>
          {status === "success" && (
            <p className="text-sm text-muted-foreground">
              If this was a mistake, you can <Link href="/about?subscribe=true" className="text-primary underline">subscribe again</Link>.
            </p>
          )}
          <div className="pt-4">
            <Button asChild>
              <Link href={content.buttonHref}>
                {content.buttonText}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}