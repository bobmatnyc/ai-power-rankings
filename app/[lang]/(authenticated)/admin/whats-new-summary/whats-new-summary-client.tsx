"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles,
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  FileText,
  Wrench,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

interface SummaryMetadata {
  articleCount?: number;
  toolCount?: number;
  rankingChanges?: number;
  siteUpdates?: number;
}

interface SummaryResult {
  period: string;
  content: string;
  generatedAt: string;
  metadata: SummaryMetadata;
}

interface MonthOption {
  value: string;
  label: string;
}

/**
 * Generate list of last 12 months in YYYY-MM format
 */
const generateMonthOptions = (): MonthOption[] => {
  const options: MonthOption[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    options.push({ value: period, label });
  }

  return options;
};

export default function WhatsNewSummaryClient() {
  const params = useParams();
  const lang = (params?.["lang"] as string) || "en";

  // State management
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationTimeMs, setGenerationTimeMs] = useState<number>(0);

  const monthOptions = generateMonthOptions();

  /**
   * Handle summary generation
   */
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/whats-new/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: selectedPeriod || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate summary");
      }

      const data = await response.json();
      setResult(data.summary);
      setGenerationTimeMs(data.generationTimeMs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Format period for display
   */
  const formatPeriod = (period: string) => {
    const [year, month] = period.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Back Button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => {
            window.location.href = `/${lang}/admin`;
          }}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Dashboard
        </Button>
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Monthly Summary Management</h1>
        </div>
        <p className="text-muted-foreground">
          Generate or regenerate monthly &quot;What&apos;s New&quot; summaries for any month
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Display */}
      {result && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Summary generated successfully in {(generationTimeMs / 1000).toFixed(2)} seconds
          </AlertDescription>
        </Alert>
      )}

      {/* Generation Form */}
      {!result && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Generate Summary
            </CardTitle>
            <CardDescription>
              Select a month to generate or regenerate its summary. Leave blank for current month.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Month / Year</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a month (or leave blank for current)" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leaving this blank will generate for the current month
              </p>
            </div>

            {/* Status Display during generation */}
            {generating && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Generating summary...</p>
                    <p className="text-sm text-muted-foreground">
                      This may take 30-60 seconds
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Summary
                </>
              )}
            </Button>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This will force regeneration even if a summary already
                exists for the selected period.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result Preview */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Generated Summary</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate Another
              </Button>
            </CardTitle>
            <CardDescription>
              {formatPeriod(result.period)} • Generated in{" "}
              {(generationTimeMs / 1000).toFixed(2)}s
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metadata Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Articles</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {result.metadata.articleCount || 0}
                </div>
              </div>

              <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Tools</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {result.metadata.toolCount || 0}
                </div>
              </div>

              <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Rankings</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {result.metadata.rankingChanges || 0}
                </div>
              </div>

              <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Updates</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {result.metadata.siteUpdates || 0}
                </div>
              </div>
            </div>

            {/* Content Preview */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Preview
              </h4>
              <div className="prose dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4">
                <p className="line-clamp-6 text-sm">
                  {result.content.substring(0, 500)}
                  {result.content.length > 500 && "..."}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button asChild className="flex-1">
                <Link href={`/${lang}/whats-new`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Full Summary
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card className="mt-6 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            • The system analyzes all content changes for the selected month
          </p>
          <p>
            • AI generates a comprehensive summary highlighting key updates
          </p>
          <p>
            • Summaries are cached for performance but can be regenerated anytime
          </p>
          <p>
            • The generated summary appears on the public &quot;What&apos;s New&quot; page
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
