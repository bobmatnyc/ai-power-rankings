"use client";

import { AlertCircle, ArrowLeft, CheckCircle, FileText, Loader2, Link as LinkIcon, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface AnalysisResult {
  title: string;
  summary: string;
  rewritten_content?: string;
  source: string;
  url?: string;
  published_date: string;
  tool_mentions: Array<{
    tool: string;
    context: string;
    sentiment: number;
  }>;
  overall_sentiment: number;
  key_topics: string[];
  importance_score: number;
  qualitative_metrics?: {
    innovation_boost: number;
    business_sentiment: number;
    development_velocity: number;
    market_traction: number;
  };
}

export default function NewArticlePage() {
  const params = useParams();
  const router = useRouter();
  const lang = (params?.["lang"] as string) || "en";

  // Input state
  const [inputType, setInputType] = useState<"url" | "text" | "file">("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Commit state
  const [committing, setCommitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = [
        "text/plain",
        "text/markdown",
        "application/pdf",
        "application/json",
      ];

      const isValidType = validTypes.includes(file.type) ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".txt");

      if (!isValidType) {
        setError("Please upload a text file (.txt, .md, .pdf, .json)");
        return;
      }

      setFileInput(file);
      setFileName(file.name);
      setError(null);
    }
  };

  const handleAnalyze = async (saveAsArticle = false) => {
    setAnalyzing(true);
    setError(null);

    try {
      let input: string | undefined;
      let type: "url" | "text" | "file" | "preprocessed";
      let filename: string | undefined;
      let mimeType: string | undefined;
      let preprocessedData: AnalysisResult | undefined;

      // Determine input based on type
      if (saveAsArticle && analysis) {
        // Reuse existing analysis when committing
        type = "preprocessed";
        preprocessedData = analysis;
        input = undefined; // Not needed when using preprocessed data
      } else if (inputType === "url") {
        if (!urlInput.trim()) {
          throw new Error("Please enter a URL");
        }
        input = urlInput.trim();
        type = "url";
      } else if (inputType === "text") {
        if (!textInput.trim()) {
          throw new Error("Please enter some text");
        }
        input = textInput.trim();
        type = "text";
      } else if (inputType === "file") {
        if (!fileInput) {
          throw new Error("Please select a file");
        }
        // Read file as base64
        const reader = new FileReader();
        input = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix
            const base64 = result.split(",")[1] || result;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(fileInput);
        });
        type = "file";
        filename = fileInput.name;
        mimeType = fileInput.type || "text/plain";
      } else {
        throw new Error("Invalid input type");
      }

      // Call analyze API
      const response = await fetch("/api/admin/news/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: type === "preprocessed" ? undefined : input,
          type,
          filename,
          mimeType,
          verbose: true,
          saveAsArticle,
          preprocessedData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze content");
      }

      const result = await response.json();

      if (saveAsArticle) {
        // Article was saved successfully
        setSuccess(true);
        setCommitting(false);
        setTimeout(() => {
          router.push(`/${lang}/admin/news`);
        }, 1500);
      } else {
        // Preview mode - show analysis
        setAnalysis(result.analysis);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze content");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    await handleAnalyze(true);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href={`/${lang}/admin/news`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to News
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Create New Article</h1>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Article created successfully! Redirecting...</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Article Input</CardTitle>
            <CardDescription>
              Choose your input method: URL, paste text, or upload a file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as typeof inputType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="url">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  URL
                </TabsTrigger>
                <TabsTrigger value="text">
                  <FileText className="h-4 w-4 mr-2" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="file">
                  <Upload className="h-4 w-4 mr-2" />
                  File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4">
                <div>
                  <Label htmlFor="url-input">Article URL</Label>
                  <Input
                    id="url-input"
                    type="url"
                    placeholder="https://example.com/article"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter the URL of an article to fetch and analyze
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4">
                <div>
                  <Label htmlFor="text-input">Article Text</Label>
                  <Textarea
                    id="text-input"
                    placeholder="Paste your article content here..."
                    rows={20}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Paste the article content directly
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="file" className="space-y-4">
                <div>
                  <Label htmlFor="file-input">Upload File</Label>
                  <Input
                    id="file-input"
                    type="file"
                    accept=".txt,.md,.pdf,.json,text/plain,text/markdown,application/pdf,application/json"
                    onChange={handleFileChange}
                  />
                  {fileName && (
                    <div className="mt-2">
                      <Badge variant="secondary">{fileName}</Badge>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Supported formats: .txt, .md, .pdf, .json
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex gap-2">
              <Button
                onClick={() => handleAnalyze(false)}
                disabled={analyzing || committing}
                className="flex-1"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze (Preview)
                  </>
                )}
              </Button>
              {analysis && (
                <Button
                  onClick={handleCommit}
                  disabled={analyzing || committing}
                  variant="default"
                  className="flex-1"
                >
                  {committing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Commit Article
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              {analysis
                ? "Preview the extracted information"
                : "Results will appear here after analysis"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!analysis ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click &quot;Analyze (Preview)&quot; to extract article information</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Title</Label>
                  <p className="text-sm mt-1">{analysis.title}</p>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Summary</Label>
                  <p className="text-sm mt-1">{analysis.summary}</p>
                </div>

                {analysis.rewritten_content && (
                  <div>
                    <Label className="text-sm font-semibold">Rewritten Content (Preview)</Label>
                    <p className="text-sm mt-1 italic text-muted-foreground">
                      {analysis.rewritten_content}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Source</Label>
                    <p className="text-sm mt-1">{analysis.source}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Published Date</Label>
                    <p className="text-sm mt-1">{analysis.published_date}</p>
                  </div>
                </div>

                {analysis.url && (
                  <div>
                    <Label className="text-sm font-semibold">URL</Label>
                    <p className="text-sm mt-1 truncate">
                      <a
                        href={analysis.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {analysis.url}
                      </a>
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold">
                    Tool Mentions ({analysis.tool_mentions.length})
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {analysis.tool_mentions.slice(0, 10).map((mention, idx) => (
                      <Badge key={idx} variant="default">
                        {mention.tool}
                      </Badge>
                    ))}
                    {analysis.tool_mentions.length > 10 && (
                      <Badge variant="secondary">+{analysis.tool_mentions.length - 10} more</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Key Topics</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {analysis.key_topics.slice(0, 8).map((topic, idx) => (
                      <Badge key={idx} variant="outline">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Importance Score</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${(analysis.importance_score / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold">
                        {analysis.importance_score}/10
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Overall Sentiment</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{
                            width: `${((analysis.overall_sentiment + 1) / 2) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold">
                        {analysis.overall_sentiment > 0 ? "+" : ""}
                        {analysis.overall_sentiment.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {analysis.qualitative_metrics && (
                  <div>
                    <Label className="text-sm font-semibold">Qualitative Metrics</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Innovation:</span>{" "}
                        <span className="font-medium">
                          {analysis.qualitative_metrics.innovation_boost}/5
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Business:</span>{" "}
                        <span className="font-medium">
                          {analysis.qualitative_metrics.business_sentiment}/2
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Dev Velocity:</span>{" "}
                        <span className="font-medium">
                          {analysis.qualitative_metrics.development_velocity}/5
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Market:</span>{" "}
                        <span className="font-medium">
                          {analysis.qualitative_metrics.market_traction}/5
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <Alert>
                  <AlertDescription className="text-xs">
                    This is a preview. Click &quot;Commit Article&quot; to save this article and
                    apply ranking changes.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tool Mentions Detail */}
      {analysis && analysis.tool_mentions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Detailed Tool Mentions</CardTitle>
            <CardDescription>
              Context and sentiment for each tool mentioned in the article
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.tool_mentions.map((mention, idx) => (
                <div key={idx} className="border-l-2 border-primary pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{mention.tool}</span>
                    <Badge
                      variant={
                        mention.sentiment > 0.3
                          ? "default"
                          : mention.sentiment < -0.3
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {mention.sentiment > 0 ? "+" : ""}
                      {mention.sentiment.toFixed(2)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{mention.context}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
