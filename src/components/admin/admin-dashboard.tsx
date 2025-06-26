"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, FileUp, Trophy, Database, TrendingUp, Settings } from "lucide-react";
import Link from "next/link";

export function AdminDashboard() {
  const { data: session } = useSession();

  const adminSections = [
    {
      title: "Payload CMS Admin",
      description: "Access the full Payload CMS admin interface for content management",
      icon: FileText,
      href: "/admin",
      color: "bg-blue-600",
      disabled: false,
      external: true,
    },
    {
      title: "Tools Management",
      description: "Advanced tools interface with search, filtering, and rankings",
      icon: FileText,
      href: "/dashboard/tools",
      color: "bg-green-500",
      disabled: false,
    },
    {
      title: "Subscribers",
      description: "Manage newsletter subscribers and email lists",
      icon: Users,
      href: "/dashboard/subscribers",
      color: "bg-indigo-500",
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {session?.user?.email}</p>
        </div>
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

          if (section.external) {
            return (
              <a
                key={section.title}
                href={section.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
              >
                {cardContent}
              </a>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
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
