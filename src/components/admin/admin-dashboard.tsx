"use client";

import { Database, FileText, FileUp, Globe, Settings, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminDashboard() {
  const session = useSession();
  const [currentLiveRanking, setCurrentLiveRanking] = useState<string | null>(null);
  const [isLoadingRanking, setIsLoadingRanking] = useState(true);

  // Use useCallback to define loadCurrentRanking before useEffect
  const loadCurrentRanking = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ranking-periods");
      if (response.ok) {
        const data = await response.json();
        const current = data.periods?.find((p: { is_current: boolean }) => p.is_current);
        if (current) {
          setCurrentLiveRanking(current.period);
        }
      }
    } catch (err) {
      console.error("Failed to load current ranking:", err);
    } finally {
      setIsLoadingRanking(false);
    }
  }, []); // Empty dependency array since this function doesn't depend on any props or state

  useEffect(() => {
    loadCurrentRanking();
  }, [loadCurrentRanking]);

  const adminSections = [
    {
      title: "Tools Management",
      description: "Advanced tools interface with search, filtering, and rankings",
      icon: FileText,
      href: "/dashboard/tools",
      color: "bg-green-500",
      disabled: false,
    },
    {
      title: "News Ingestion",
      description: "Upload and manage news articles",
      icon: FileUp,
      href: "/dashboard/news-ingestion",
      color: "bg-orange-500",
      disabled: false,
    },
    {
      title: "Rankings Management",
      description: "Preview and generate AI tool rankings",
      icon: Trophy,
      href: "/dashboard/rankings",
      color: "bg-yellow-500",
      disabled: false,
    },
    {
      title: "Cache Management",
      description: "Manage static JSON cache files for offline functionality",
      icon: Database,
      href: "/dashboard/cache",
      color: "bg-purple-500",
      disabled: false,
    },
    {
      title: "Analytics",
      description: "View detailed analytics and user engagement metrics",
      icon: TrendingUp,
      href: "/dashboard/analytics",
      color: "bg-gray-500",
      disabled: true,
    },
    {
      title: "Settings",
      description: "Configure site settings and preferences",
      icon: Settings,
      href: "/dashboard/settings",
      color: "bg-gray-500",
      disabled: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* User Welcome */}
      <div className="text-sm text-muted-foreground">
        Welcome back, {session?.data?.user?.email}
      </div>

      {/* Admin Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {adminSections.map((section) => {
          const Icon = section.icon;

          const cardContent = (
            <Card
              className={`transition-all hover:shadow-lg h-full ${
                section.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:scale-105 cursor-pointer hover:border-primary/20"
              }`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${section.color} text-white`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{section.title}</CardTitle>
                    {section.disabled && (
                      <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{section.description}</p>
              </CardContent>
            </Card>
          );

          if (section.disabled) {
            return (
              <div key={section.title} className="block">
                {cardContent}
              </div>
            );
          }

          return (
            <Link key={section.title} href={section.href} className="block h-full">
              {cardContent}
            </Link>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Live Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold">
                {isLoadingRanking ? (
                  <span className="text-sm text-muted-foreground">Loading...</span>
                ) : currentLiveRanking ? (
                  currentLiveRanking
                ) : (
                  <span className="text-sm text-red-600">Not Set</span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentLiveRanking ? "Currently showing on live site" : "No ranking set as live"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              Tools, Subscribers, News, Rankings & Cache
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Updated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Today</div>
            <p className="text-xs text-muted-foreground">Authentication system deployed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
