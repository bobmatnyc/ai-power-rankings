import { CheckCircle, ExternalLink, XCircle } from "lucide-react";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ComparisonTool {
  name: string;
  category: string;
  pricing: string;
  keyFeatures: string[];
  pros: string[];
  cons: string[];
  rating?: number;
  users?: number;
  website?: string;
}

interface ComparisonTableProps {
  title?: string;
  tools: ComparisonTool[];
  focusedTool?: string; // Name of the tool to highlight
  className?: string;
}

export const ComparisonTable = memo(function ComparisonTable({
  title = "Tool Comparison",
  tools,
  focusedTool,
  className = "",
}: ComparisonTableProps) {
  if (tools.length === 0) {
    return null;
  }

  const features = Array.from(new Set(tools.flatMap((tool) => tool.keyFeatures))).slice(0, 8); // Limit to most important features

  const formatUserCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M+`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(0)}K+`;
    }
    return count.toString();
  };

  return (
    <Card className={className} itemScope itemType="https://schema.org/Table">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-semibold">Feature</th>
                {tools.map((tool) => (
                  <th
                    key={tool.name}
                    className={`text-center p-4 font-semibold min-w-[150px] ${
                      focusedTool === tool.name ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="font-bold">{tool.name}</div>
                      <Badge variant="secondary" className="text-xs">
                        {tool.category.replace(/-/g, " ")}
                      </Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Pricing Row */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium">Pricing</td>
                {tools.map((tool) => (
                  <td
                    key={`${tool.name}-pricing`}
                    className={`text-center p-4 ${focusedTool === tool.name ? "bg-primary/5" : ""}`}
                  >
                    <div className="text-sm">{tool.pricing}</div>
                  </td>
                ))}
              </tr>

              {/* Rating Row */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium">Rating</td>
                {tools.map((tool) => (
                  <td
                    key={`${tool.name}-rating`}
                    className={`text-center p-4 ${focusedTool === tool.name ? "bg-primary/5" : ""}`}
                  >
                    <div className="text-sm">{tool.rating ? `${tool.rating}/100` : "N/A"}</div>
                  </td>
                ))}
              </tr>

              {/* Users Row */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium">Users</td>
                {tools.map((tool) => (
                  <td
                    key={`${tool.name}-users`}
                    className={`text-center p-4 ${focusedTool === tool.name ? "bg-primary/5" : ""}`}
                  >
                    <div className="text-sm">
                      {tool.users ? formatUserCount(tool.users) : "N/A"}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Feature Rows */}
              {features.map((feature) => (
                <tr key={feature} className="border-b hover:bg-muted/50">
                  <td className="p-4 font-medium">{feature}</td>
                  {tools.map((tool) => (
                    <td
                      key={`${tool.name}-${feature}`}
                      className={`text-center p-4 ${
                        focusedTool === tool.name ? "bg-primary/5" : ""
                      }`}
                    >
                      {tool.keyFeatures.includes(feature) ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Action Row */}
              <tr>
                <td className="p-4 font-medium">Try It</td>
                {tools.map((tool) => (
                  <td
                    key={`${tool.name}-action`}
                    className={`text-center p-4 ${focusedTool === tool.name ? "bg-primary/5" : ""}`}
                  >
                    {tool.website ? (
                      <Button size="sm" asChild>
                        <a href={tool.website} target="_blank" rel="noopener noreferrer">
                          Try {tool.name}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile-friendly comparison cards for smaller screens */}
        <div className="md:hidden mt-6 space-y-4">
          {tools.map((tool) => (
            <Card
              key={`mobile-${tool.name}`}
              className={focusedTool === tool.name ? "border-primary" : ""}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {tool.name}
                  <Badge variant="secondary">{tool.category.replace(/-/g, " ")}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <strong>Pricing:</strong> {tool.pricing}
                </div>
                <div>
                  <strong>Rating:</strong> {tool.rating ? `${tool.rating}/100` : "N/A"}
                </div>
                <div>
                  <strong>Users:</strong> {tool.users ? formatUserCount(tool.users) : "N/A"}
                </div>
                <div className="pt-2">
                  <strong>Features:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {features.map((feature) => (
                      <Badge
                        key={feature}
                        variant={tool.keyFeatures.includes(feature) ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                {tool.website && (
                  <Button size="sm" className="w-full mt-4" asChild>
                    <a href={tool.website} target="_blank" rel="noopener noreferrer">
                      Try {tool.name}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
