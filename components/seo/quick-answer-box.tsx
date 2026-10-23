import { CheckCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickAnswerBoxProps {
  question: string;
  answer: string;
  type?: "info" | "highlight" | "definition";
  className?: string;
}

export function QuickAnswerBox({
  question,
  answer,
  type = "info",
  className = "",
}: QuickAnswerBoxProps) {
  const getIcon = () => {
    switch (type) {
      case "highlight":
        return <CheckCircle className="h-5 w-5 text-ds-success-fixed-mid" />;
      case "definition":
        return <Info className="h-5 w-5 text-ds-accent-fixed" />;
      default:
        return <Info className="h-5 w-5 text-ds-accent-fixed" />;
    }
  };

  const getCardStyle = () => {
    switch (type) {
      case "highlight":
        return "border-ds-border-callout-success bg-ds-surface-callout-success";
      case "definition":
        return "border-ds-border-callout-info bg-ds-surface-callout-info";
      default:
        return "border-muted";
    }
  };

  return (
    <Card
      className={`${getCardStyle()} ${className}`}
      itemScope
      itemType="https://schema.org/Question"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold" itemProp="name">
          {getIcon()}
          {question}
        </CardTitle>
      </CardHeader>
      <CardContent itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
        <div
          itemProp="text"
          className="text-muted-foreground leading-relaxed"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Answer content is trusted and needed for SEO
          dangerouslySetInnerHTML={{ __html: answer }}
        />
      </CardContent>
    </Card>
  );
}
