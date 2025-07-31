"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Clock,
  Eye,
  LogOut,
  Search,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SEOMetrics {
  organicTraffic: number;
  trafficChange: number;
  avgPosition: number;
  positionChange: number;
  topKeywords: Array<{
    keyword: string;
    position: number;
    clicks: number;
    impressions: number;
  }>;
  coreWebVitals: {
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
  };
  crawlErrors: number;
  seoScore: number;
  lastUpdated: string;
}

export function SEODashboard() {
  const { data: session, status } = useSession();
  const [metrics, setMetrics] = useState<SEOMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingSitemap, setSubmittingSitemap] = useState(false);

  const fetchSEOMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/seo/metrics");

      if (!response.ok) {
        throw new Error("Failed to fetch SEO metrics");
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchSEOMetrics();
    }
  }, [status, fetchSEOMetrics]);

  const submitSitemap = async () => {
    try {
      setSubmittingSitemap(true);
      const response = await fetch("/api/admin/seo/submit-sitemap", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit sitemap");
      }

      const data = await response.json();
      // Sitemap submitted successfully
      console.log("Sitemap submission result:", data);
    } catch (err) {
      console.error(
        `Failed to submit sitemap: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setSubmittingSitemap(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Error Loading SEO Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchSEOMetrics} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const formatChange = (change: number) => {
    const isPositive = change > 0;
    return (
      <div className={`flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span className="text-xs font-medium">
          {isPositive ? "+" : ""}
          {change.toFixed(1)}%
        </span>
      </div>
    );
  };

  const getWebVitalStatus = (value: number, threshold: number) => {
    return value <= threshold ? "good" : value <= threshold * 1.5 ? "needs-improvement" : "poor";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SEO Monitoring Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor website performance and search engine optimization metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{session?.user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Organic Traffic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.organicTraffic.toLocaleString()}</div>
            {formatChange(metrics.trafficChange)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              Avg Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgPosition.toFixed(1)}</div>
            {formatChange(-metrics.positionChange)}{" "}
            {/* Negative because lower position is better */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Crawl Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.crawlErrors}</div>
            <div className="text-xs text-muted-foreground">
              {metrics.crawlErrors === 0 ? "No issues found" : "Requires attention"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              SEO Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.seoScore}/100</div>
            <Badge
              variant={
                metrics.seoScore >= 80
                  ? "default"
                  : metrics.seoScore >= 60
                    ? "secondary"
                    : "destructive"
              }
            >
              {metrics.seoScore >= 80
                ? "Excellent"
                : metrics.seoScore >= 60
                  ? "Good"
                  : "Needs Work"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Core Web Vitals */}
      <Card>
        <CardHeader>
          <CardTitle>Core Web Vitals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Largest Contentful Paint (LCP)
              </div>
              <div className="text-2xl font-bold mb-2">{metrics.coreWebVitals.lcp.toFixed(2)}s</div>
              <Badge
                variant={
                  getWebVitalStatus(metrics.coreWebVitals.lcp, 2.5) === "good"
                    ? "default"
                    : getWebVitalStatus(metrics.coreWebVitals.lcp, 2.5) === "needs-improvement"
                      ? "secondary"
                      : "destructive"
                }
              >
                {getWebVitalStatus(metrics.coreWebVitals.lcp, 2.5) === "good"
                  ? "Good"
                  : getWebVitalStatus(metrics.coreWebVitals.lcp, 2.5) === "needs-improvement"
                    ? "Needs Improvement"
                    : "Poor"}
              </Badge>
            </div>

            <div className="text-center">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                First Input Delay (FID)
              </div>
              <div className="text-2xl font-bold mb-2">
                {metrics.coreWebVitals.fid.toFixed(0)}ms
              </div>
              <Badge
                variant={
                  getWebVitalStatus(metrics.coreWebVitals.fid, 100) === "good"
                    ? "default"
                    : getWebVitalStatus(metrics.coreWebVitals.fid, 100) === "needs-improvement"
                      ? "secondary"
                      : "destructive"
                }
              >
                {getWebVitalStatus(metrics.coreWebVitals.fid, 100) === "good"
                  ? "Good"
                  : getWebVitalStatus(metrics.coreWebVitals.fid, 100) === "needs-improvement"
                    ? "Needs Improvement"
                    : "Poor"}
              </Badge>
            </div>

            <div className="text-center">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Cumulative Layout Shift (CLS)
              </div>
              <div className="text-2xl font-bold mb-2">{metrics.coreWebVitals.cls.toFixed(3)}</div>
              <Badge
                variant={
                  getWebVitalStatus(metrics.coreWebVitals.cls, 0.1) === "good"
                    ? "default"
                    : getWebVitalStatus(metrics.coreWebVitals.cls, 0.1) === "needs-improvement"
                      ? "secondary"
                      : "destructive"
                }
              >
                {getWebVitalStatus(metrics.coreWebVitals.cls, 0.1) === "good"
                  ? "Good"
                  : getWebVitalStatus(metrics.coreWebVitals.cls, 0.1) === "needs-improvement"
                    ? "Needs Improvement"
                    : "Poor"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Keywords */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.topKeywords.map((keyword, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{keyword.keyword}</div>
                  <div className="text-sm text-muted-foreground">
                    {keyword.clicks.toLocaleString()} clicks •{" "}
                    {keyword.impressions.toLocaleString()} impressions
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">#{keyword.position}</div>
                  <div className="text-xs text-muted-foreground">Position</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={fetchSEOMetrics}>Refresh Data</Button>
        <Button variant="outline">Generate Report</Button>
        <Button variant="outline">Export Data</Button>
        <Button variant="outline" onClick={submitSitemap} disabled={submittingSitemap}>
          <Upload className="h-4 w-4 mr-2" />
          {submittingSitemap ? "Submitting..." : "Submit Sitemap"}
        </Button>
      </div>
    </div>
  );
}
