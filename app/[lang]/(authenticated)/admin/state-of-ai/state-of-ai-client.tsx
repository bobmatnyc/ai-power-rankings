"use client";

import { useState, useEffect } from "react";
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
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  FileText,
  ArrowLeft,
  Eye,
} from "lucide-react";

interface SummaryMetadata {
  article_count?: number;
  new_tool_count?: number;
  ranking_change_count?: number;
  site_change_count?: number;
  word_count?: number;
  generation_time_ms?: number;
  cost_usd?: number;
}

interface SummaryResult {
  id: string;
  month: number;
  year: number;
  content: string;
  generatedAt: string;
  generatedBy: string;
  metadata: SummaryMetadata;
}

interface MonthYearOption {
  month: number;
  year: number;
  label: string;
}

/**
 * Generate list of last 12 months
 */
const generateMonthOptions = (): MonthYearOption[] => {
  const options: MonthYearOption[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const label = date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    options.push({ month, year, label });
  }

  return options;
};

/**
 * Format month number to name
 */
const formatMonthName = (month: number): string => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1] || "Unknown";
};

export default function StateOfAiClient() {
  const params = useParams();
  const lang = (params?.["lang"] as string) || "en";

  // State management
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationTimeMs, setGenerationTimeMs] = useState<number>(0);
  const [isNew, setIsNew] = useState(false);

  const monthOptions = generateMonthOptions();

  // Set default to current month
  useEffect(() => {
    if (!selectedMonth && !selectedYear && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[0].month);
      setSelectedYear(monthOptions[0].year);
    }
  }, [monthOptions, selectedMonth, selectedYear]);

  /**
   * Handle month/year selection
   */
  const handleMonthChange = (value: string) => {
    const option = monthOptions.find((opt) => `${opt.month}-${opt.year}` === value);
    if (option) {
      setSelectedMonth(option.month);
      setSelectedYear(option.year);
      setResult(null); // Clear previous result
      setError(null);
    }
  };

  /**
   * Handle State of AI generation
   */
  const handleGenerate = async () => {
    if (!selectedMonth || !selectedYear) {
      setError("Please select a month and year");
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);
    setIsNew(false);

    try {
      const startTime = Date.now();
      const response = await fetch("/api/admin/state-of-ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          forceRegenerate: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to generate State of AI editorial");
      }

      setResult(data.summary);
      setGenerationTimeMs(data.generationTimeMs || Date.now() - startTime);
      setIsNew(data.isNew);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/${lang}/admin`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">State of AI Editorial</h1>
          </div>
          <p className="text-muted-foreground">
            Generate monthly "State of AI" editorial summaries using Claude Sonnet 4
          </p>
        </div>
      </div>

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate State of AI Editorial
          </CardTitle>
          <CardDescription>
            Create a 400-500 word editorial analyzing the AI industry for the selected month
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Month Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Select Month & Year
            </label>
            <Select
              value={selectedMonth && selectedYear ? `${selectedMonth}-${selectedYear}` : undefined}
              onValueChange={handleMonthChange}
              disabled={generating}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select month and year..." />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={`${option.month}-${option.year}`} value={`${option.month}-${option.year}`}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !selectedMonth || !selectedYear}
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Editorial... (~30-60 seconds)
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate State of AI Editorial
              </>
            )}
          </Button>

          {/* Info */}
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Note:</strong> Generation analyzes the last 4 weeks of AI news, rankings, and tool
              launches. Uses Claude Sonnet 4 via OpenRouter (~$0.01-0.03 per generation).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Display */}
      {result && (
        <>
          <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {isNew ? (
                <>
                  <strong>Editorial Generated Successfully!</strong> Created in {generationTimeMs}ms
                </>
              ) : (
                <>
                  <strong>Editorial Already Exists</strong> Retrieved existing editorial for{" "}
                  {formatMonthName(result.month)} {result.year}
                </>
              )}
            </AlertDescription>
          </Alert>

          {/* Result Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    State of Agentic Coding: {formatMonthName(result.month)} {result.year}
                  </CardTitle>
                  <CardDescription>
                    Generated {new Date(result.generatedAt).toLocaleDateString()} by {result.generatedBy}
                  </CardDescription>
                </div>
                <Link
                  href={`/${lang}/whats-new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Eye className="h-4 w-4" />
                  Preview Live
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">Articles</div>
                  <div className="text-xl font-semibold">{result.metadata.article_count || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">New Tools</div>
                  <div className="text-xl font-semibold">{result.metadata.new_tool_count || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Word Count</div>
                  <div className="text-xl font-semibold">{result.metadata.word_count || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cost</div>
                  <div className="text-xl font-semibold">
                    ${(result.metadata.cost_usd || 0).toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Content Preview */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Editorial Content (Markdown)</h3>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                    {result.content}
                  </pre>
                </div>
              </div>

              {/* Instructions */}
              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Next Steps:</strong> This editorial is now stored and will be displayed on the{" "}
                  <Link href={`/${lang}/whats-new`} className="text-primary hover:underline">
                    What's New
                  </Link>{" "}
                  page. The StateOfUnion component will automatically fetch and display it.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
