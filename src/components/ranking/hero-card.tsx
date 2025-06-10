import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToolIcon } from "@/components/ui/tool-icon";
import Link from "next/link";

interface RankingData {
  rank: number;
  tool: {
    id: string;
    name: string;
    category: string;
    status: string;
    website_url?: string;
    description?: string;
  };
  scores: {
    overall: number;
    agentic_capability: number;
    innovation: number;
  };
  metrics: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
  };
}

interface HeroCardProps {
  ranking: RankingData;
  index: number;
}

export function HeroCard({ ranking, index }: HeroCardProps) {
  return (
    <Card 
      className={`relative group hover:shadow-xl transition-all duration-300 border-border/50 ${
        index === 0 ? 'md:scale-105 border-primary/30 shadow-lg' : 'hover:border-primary/20'
      }`}
    >
      {index === 0 && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-gradient-primary text-white border-0 shadow-lg">
            🏆 #1 Ranked
          </Badge>
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <ToolIcon 
            name={ranking.tool.name}
            domain={ranking.tool.website_url}
            size={64}
            className="flex-shrink-0"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">
                {ranking.tool.name}
              </CardTitle>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                #{ranking.rank}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {ranking.tool.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {ranking.tool.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {ranking.tool.description}
            </p>
          )}
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Score</span>
              <div className="font-semibold text-lg text-primary">
                {ranking.scores?.overall?.toFixed(1) || "-"}/10
              </div>
            </div>
            {ranking.metrics?.swe_bench_score && (
              <div>
                <span className="text-muted-foreground">SWE-bench</span>
                <div className="font-semibold text-lg text-accent">
                  {ranking.metrics.swe_bench_score.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 gradient-primary text-white hover:opacity-90" size="sm" asChild>
              <Link href={`/tools/${ranking.tool.id}`}>
                View Details
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}