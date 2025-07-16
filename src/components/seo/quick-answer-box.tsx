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
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "definition":
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getCardStyle = () => {
    switch (type) {
      case "highlight":
        return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950";
      case "definition":
        return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950";
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
          dangerouslySetInnerHTML={{ __html: answer }}
        />
      </CardContent>
    </Card>
  );
}
