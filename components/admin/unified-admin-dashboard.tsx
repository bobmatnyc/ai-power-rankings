"use client";

import {
  AlertCircle,
  Database,
  History,
  Loader2,
  Newspaper,
  Wrench,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArticleManagement } from "@/components/admin/article-management";
import { ToolsManager } from "@/components/admin/tools-manager";
// SubscribersPage removed - using Clerk for user management
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DatabaseStatus {
  connected: boolean;
  enabled: boolean;
  configured: boolean;
  hasActiveInstance: boolean;
  environment: string;
  nodeEnv: string;
  database: string;
  host: string;
  maskedHost?: string;
  provider: string;
  timestamp: string;
  status: string;
  type?: "postgresql" | "json";
  displayEnvironment?: "development" | "production" | "local";
}

export default function UnifiedAdminDashboard() {
  const params = useParams();
  const lang = (params?.["lang"] as string) || "en";
  const [activeTab, setActiveTab] = useState("articles");
  const [error, setError] = useState<string | null>(null);
  const [errorDetails] = useState<{
    type?: string;
    troubleshooting?: string[];
  } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [showDbStatus, setShowDbStatus] = useState(true);
  const [isLoadingDbStatus, setIsLoadingDbStatus] = useState(true);

  // Load database status
  const loadDatabaseStatus = useCallback(async () => {
    setIsLoadingDbStatus(true);

    // Don't load DB status if we've already closed it
    if (!showDbStatus) {
      setIsLoadingDbStatus(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/db-status", {
        credentials: "same-origin", // Use same-origin for better Clerk compatibility
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Try to get the response as text for debugging
        const text = await response.text();

        // Check if it's an HTML error page
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          console.error("[UnifiedAdminDashboard] Received HTML response instead of JSON");
        }
        return;
      }

      if (!response.ok) {
        // Enhanced error logging for debugging
        console.error("[UnifiedAdminDashboard] Database status request failed:", {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });

        // Handle errors with better logging
        if (response.status === 401) {
          console.error(
            "[UnifiedAdminDashboard] Authentication failed for database status. " +
              "This might be a credentials configuration issue."
          );
          return;
        } else if (response.status === 404) {
          console.error("[UnifiedAdminDashboard] Database status API route not found");
        }
        return;
      }

      // Parse the successful JSON response
      try {
        const data = await response.json();
        setDbStatus(data);
      } catch (parseError) {
        console.error("Failed to parse database status response:", parseError);
      }
    } catch (err) {
      // Network error
      if (err instanceof TypeError && err.message.includes("fetch")) {
        console.error("[UnifiedAdminDashboard] Network error fetching database status:", err);
      }
    } finally {
      setIsLoadingDbStatus(false);
    }
  }, [showDbStatus]);

  // Load database status on component mount
  useEffect(() => {
    // Add a small delay before loading database status to ensure cookies are properly set
    if (showDbStatus) {
      const timer = setTimeout(() => {
        loadDatabaseStatus();
      }, 100); // Small delay to ensure authentication is ready

      return () => clearTimeout(timer);
    }
    return undefined; // Explicit return for when showDbStatus is false
  }, [loadDatabaseStatus, showDbStatus]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Database Status Indicator */}
      {showDbStatus && (
        <Card
          className="mb-4 border-l-4"
          style={{
            borderLeftColor:
              dbStatus?.type === "json"
                ? "#3b82f6"
                : // Blue for JSON
                  dbStatus?.displayEnvironment === "development"
                  ? "#10b981"
                  : // Green for Dev
                    dbStatus?.displayEnvironment === "production"
                    ? "#ef4444"
                    : // Red for Prod
                      "#6b7280", // Gray for unknown
          }}
        >
          <CardContent className="py-3 px-4">
            {isLoadingDbStatus ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                <span className="text-sm text-gray-600">Loading database status...</span>
              </div>
            ) : dbStatus ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database
                      className={`h-5 w-5 ${
                        dbStatus.type === "json"
                          ? "text-blue-600"
                          : dbStatus.displayEnvironment === "development"
                            ? "text-green-600"
                            : dbStatus.displayEnvironment === "production"
                              ? "text-red-600"
                              : "text-gray-600"
                      }`}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">
                        <span className="font-medium">Database:</span>{" "}
                        {dbStatus.type === "json" ? (
                          <span className="text-blue-600">JSON Files</span>
                        ) : (
                          <>
                            <span className="text-gray-500">
                              ({dbStatus.displayEnvironment === "development" ? "Development" : "Production"})
                            </span>{" "}
                            <span className="font-mono">
                              {dbStatus.maskedHost && dbStatus.maskedHost !== "N/A"
                                ? dbStatus.maskedHost.split('.')[0]
                                : dbStatus.database}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadDatabaseStatus}
                      disabled={isLoadingDbStatus}
                      className="h-7 px-2"
                      title="Refresh database status"
                    >
                      {isLoadingDbStatus ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <History className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDbStatus(false)}
                      className="h-7 w-7 p-0"
                      title="Hide database status"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Status Messages */}
                {dbStatus.type === "json" && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                    <span className="text-xs text-blue-700">
                      Using local JSON file storage. Database features disabled.
                    </span>
                  </div>
                )}
                {dbStatus.type !== "json" && !dbStatus.connected && dbStatus.configured && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-red-500" />
                    <span className="text-xs text-red-600">
                      Database is configured but not connected. Check your connection settings.
                    </span>
                  </div>
                )}
                {dbStatus.type !== "json" && !dbStatus.configured && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-yellow-500" />
                    <span className="text-xs text-yellow-700">
                      Database not configured. Set DATABASE_URL to enable PostgreSQL.
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Database status pending...</span>
                </div>
                <Button variant="ghost" size="sm" onClick={loadDatabaseStatus} className="h-7 px-2">
                  <History className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI-Powered Admin Dashboard</h1>
          <p className="text-gray-600">Streamlined news ingestion and ranking management</p>
        </div>
        <div className="flex gap-2">
          {!showDbStatus && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDbStatus(true)}
              className="flex items-center gap-2"
              title="Show database status"
            >
              <Database className="h-4 w-4" />
              <span>DB Status</span>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
            className="flex items-center gap-2"
          >
            <span>← Exit Admin</span>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              // Call logout API
              await fetch("/api/admin/auth", {
                method: "DELETE",
                credentials: "same-origin",
              });
              window.location.href = `/${lang}/admin/auth/signin`;
            }}
            className="flex items-center gap-2"
          >
            <span>Logout</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant={errorDetails?.type ? "destructive" : "default"} className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">{error}</p>
              {errorDetails?.type && (
                <p className="text-sm text-muted-foreground">
                  Error type: {errorDetails.type.replace(/_/g, " ")}
                </p>
              )}
              {errorDetails?.troubleshooting && (
                <div className="mt-2">
                  <p className="text-sm font-medium">Troubleshooting steps:</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {errorDetails.troubleshooting.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="articles">
            <Newspaper className="mr-2 h-4 w-4" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Wrench className="mr-2 h-4 w-4" />
            Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-6">
          <ArticleManagement />
        </TabsContent>

        <TabsContent value="tools" className="space-y-6">
          <ToolsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
