import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Star, Users, Code, Building, CheckCircle, XCircle } from "lucide-react";
import { QuickAnswerBox } from "./quick-answer-box";
import { extractTextFromRichText } from "@/lib/richtext-utils";

interface ToolOverviewProps {
  tool: {
    name: string;
    category: string;
    description: string | any[]; // Can be string or RichText array
    company?: string;
    website?: string;
    keyFeatures?: string[];
    pros?: string[];
    cons?: string[];
    pricing?: string;
    users?: number;
    rating?: number;
  };
}

export function ToolOverview({ tool }: ToolOverviewProps) {
  const formatUserCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M+ users`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(0)}K+ users`;
    }
    return `${count} users`;
  };

  return (
    <article className="space-y-6" itemScope itemType="https://schema.org/SoftwareApplication">
      {/* Main Definition */}
      <QuickAnswerBox
        question={`What is ${tool.name}?`}
        answer={extractTextFromRichText(tool.description)}
        type="definition"
        className="mb-6"
      />

      {/* Key Information Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Code className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="font-semibold">Category</div>
            <div className="text-sm text-muted-foreground capitalize">
              {tool.category.replace(/-/g, " ")}
            </div>
          </CardContent>
        </Card>

        {tool.company && (
          <Card>
            <CardContent className="p-4 text-center">
              <Building className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="font-semibold">Company</div>
              <div className="text-sm text-muted-foreground">{tool.company}</div>
            </CardContent>
          </Card>
        )}

        {tool.users && (
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="font-semibold">Users</div>
              <div className="text-sm text-muted-foreground">{formatUserCount(tool.users)}</div>
            </CardContent>
          </Card>
        )}

        {tool.rating && (
          <Card>
            <CardContent className="p-4 text-center">
              <Star className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="font-semibold">Rating</div>
              <div className="text-sm text-muted-foreground">{tool.rating}/100</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Key Features Section */}
      {tool.keyFeatures && tool.keyFeatures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Key Features of {tool.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2" itemProp="featureList">
              {tool.keyFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Pros and Cons */}
      {(tool.pros?.length || tool.cons?.length) && (
        <div className="grid md:grid-cols-2 gap-4">
          {tool.pros && tool.pros.length > 0 && (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CardHeader>
                <CardTitle className="text-green-700 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Pros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {tool.pros.map((pro, index) => (
                    <li key={index} className="text-sm text-green-600 dark:text-green-400">
                      • {pro}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {tool.cons && tool.cons.length > 0 && (
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <CardHeader>
                <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Cons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {tool.cons.map((con, index) => (
                    <li key={index} className="text-sm text-red-600 dark:text-red-400">
                      • {con}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pricing Information */}
      {tool.pricing && (
        <QuickAnswerBox
          question={`How much does ${tool.name} cost?`}
          answer={tool.pricing}
          type="highlight"
        />
      )}

      {/* Call to Action */}
      {tool.website && (
        <Card className="text-center">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold mb-2">Try {tool.name}</h3>
            <p className="text-muted-foreground mb-4">
              Get started with {tool.name} today and see how it can improve your workflow.
            </p>
            <Button asChild size="lg">
              <a href={tool.website} target="_blank" rel="noopener noreferrer">
                Visit {tool.name}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Schema.org structured data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: tool.name,
          description: tool.description,
          applicationCategory: tool.category,
          ...(tool.company && {
            creator: {
              "@type": "Organization",
              name: tool.company,
            },
          }),
          ...(tool.rating && {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: tool.rating,
              bestRating: 100,
            },
          }),
          ...(tool.website && { url: tool.website }),
        })}
      </script>
    </article>
  );
}
