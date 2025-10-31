"use client";

import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle,
  Cloud,
  Download,
  FileJson,
  HardDrive,
  Info,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CacheFileStatus {
  type: string;
  source: "filesystem" | "blob" | "none";
  exists: boolean;
  size?: number;
  lastModified?: string;
  error?: string;
  blobMetadata?: {
    generatedAt: string;
    size: number;
  };
}

interface CacheStatus {
  cacheFiles: CacheFileStatus[];
  environment: {
    nodeEnv: string;
    isVercel: boolean;
    vercelEnv?: string;
    cacheEnabled: boolean;
  };
  storage: {
    blobAvailable: boolean;
    blobToken: boolean;
  };
  timestamp: string;
}

interface GenerationResult {
  type: string;
  success: boolean;
  error?: string;
  dataSize?: number;
  timestamp: string;
}

export function CacheManagementClient() {
  const [status, setStatus] = useState<CacheStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [lastGeneration, setLastGeneration] = useState<Record<string, GenerationResult>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchCacheStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/cache/status");
      if (!response.ok) {
        throw new Error("Failed to fetch cache status");
      }
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setError("Failed to fetch cache status");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch cache status on mount
  useEffect(() => {
    fetchCacheStatus();
  }, [fetchCacheStatus]);

  const generateCache = async (type: string) => {
    setGenerating({ ...generating, [type]: true });

    try {
      const response = await fetch("/api/admin/cache/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate cache");
      }

      const data = await response.json();
      const result = data.results[0];

      setLastGeneration({ ...lastGeneration, [type]: result });

      if (result.success) {
        // Success - status will be shown in UI
        fetchCacheStatus(); // Refresh status
      } else {
        // Error will be shown in lastGeneration UI
      }
    } catch (error) {
      setError(`Error generating ${type} cache`);
      console.error(error);
    } finally {
      setGenerating({ ...generating, [type]: false });
    }
  };

  const downloadCache = async (type: string) => {
    try {
      const response = await fetch(`/api/admin/cache/download?type=${type}`);
      if (!response.ok) {
        throw new Error("Failed to download cache");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Download started
    } catch (error) {
      setError(`Failed to download ${type} cache`);
      console.error(error);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) {
      return "0 Bytes";
    }
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isProduction =
    status?.environment.isVercel && status?.environment.vercelEnv === "production";
  const usingBlobStorage = status?.storage.blobAvailable;

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Environment Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Environment Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Environment</p>
              <p className="font-medium">{status?.environment.nodeEnv}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Platform</p>
              <p className="font-medium">{status?.environment.isVercel ? "Vercel" : "Local"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vercel Env</p>
              <p className="font-medium">{status?.environment.vercelEnv || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cache Enabled</p>
              <Badge variant={status?.environment.cacheEnabled ? "default" : "secondary"}>
                {status?.environment.cacheEnabled ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Storage Type</p>
              <div className="flex items-center gap-2">
                {status?.storage.blobAvailable ? (
                  <>
                    <Cloud className="h-4 w-4" />
                    <span className="font-medium">Blob Storage</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="h-4 w-4" />
                    <span className="font-medium">Filesystem</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Production Warning */}
      {isProduction && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-semibold">Production Environment</AlertDescription>
          <AlertDescription>
            Cache files cannot be written directly in production. Generate the cache data, download
            the files, and update them in the repository manually.
          </AlertDescription>
        </Alert>
      )}

      {/* Cache Files */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Caches</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {status?.cacheFiles.map((file) => (
              <Card key={file.type}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileJson className="h-5 w-5" />
                      {file.type}.json
                    </span>
                    {file.exists ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {file.source === "blob" ? (
                      <>
                        <Cloud className="h-3 w-3" />
                        <span>Stored in Vercel Blob</span>
                      </>
                    ) : file.source === "filesystem" ? (
                      <>
                        <HardDrive className="h-3 w-3" />
                        <span>Stored in filesystem</span>
                      </>
                    ) : (
                      <span>No cache available</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {file.exists && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size:</span>
                        <span>{formatBytes(file.size)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Modified:</span>
                        <span>
                          {file.lastModified
                            ? formatDistanceToNow(new Date(file.lastModified), { addSuffix: true })
                            : "Unknown"}
                        </span>
                      </div>
                      {file.source === "blob" && file.blobMetadata && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">
                            Blob Storage Details:
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Generated:</span>
                              <span>
                                {formatDistanceToNow(new Date(file.blobMetadata.generatedAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {lastGeneration[file.type] && (
                    <Alert
                      variant={lastGeneration[file.type]?.success ? "default" : "destructive"}
                      className="text-sm"
                    >
                      <AlertDescription>
                        Last generation: {lastGeneration[file.type]?.success ? "Success" : "Failed"}
                        {lastGeneration[file.type]?.error && (
                          <span className="block mt-1">{lastGeneration[file.type]?.error}</span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateCache(file.type)}
                      disabled={generating[file.type]}
                      className="flex-1"
                    >
                      {generating[file.type] ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Generate
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadCache(file.type)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Individual cache tabs would show more detailed info */}
        <TabsContent value="rankings">
          <Card>
            <CardHeader>
              <CardTitle>Rankings Cache Details</CardTitle>
              <CardDescription>
                Contains pre-calculated rankings with news-enhanced scoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The rankings cache includes tool positions, scores, and tier assignments based on
                the v6-news algorithm.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card>
            <CardHeader>
              <CardTitle>Tools Cache Details</CardTitle>
              <CardDescription>Contains all tool information and metadata</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The tools cache includes tool profiles, categories, companies, and detailed
                information.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="news">
          <Card>
            <CardHeader>
              <CardTitle>News Cache Details</CardTitle>
              <CardDescription>Contains recent news articles and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The news cache includes articles, impact levels, related tools, and publication
                dates.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Update Cache Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">For Local Development:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Click &quot;Generate&quot; to create fresh cache data from the database</li>
              <li>Cache data is stored in blob storage</li>
              <li>Commit the updated files to version control</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">For Production (Vercel):</h4>
            {usingBlobStorage ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  ✅ <strong>Blob Storage is enabled!</strong> Cache updates are stored in Vercel
                  Blob.
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Click &quot;Generate&quot; to create fresh cache data</li>
                  <li>Data is automatically stored in Vercel Blob storage</li>
                  <li>Blob storage takes precedence over source files</li>
                  <li>Each deployment reverts to source files (blob is reset)</li>
                </ol>
                <Alert className="mt-2">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    To permanently update cache files, download them and commit to the repository.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Click &quot;Generate&quot; to create fresh cache data</li>
                <li>Click &quot;Download&quot; to save each cache file</li>
                <li>Cache will be automatically updated in blob storage</li>
                <li>Commit and push the changes to trigger a new deployment</li>
              </ol>
            )}
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Cache files enable the site to function even when the database is unavailable. Keep
              them up to date for the best user experience.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
