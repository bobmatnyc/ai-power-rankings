"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Settings, FileText, TrendingUp } from "lucide-react";
import Link from "next/link";

export function AdminDashboard() {
  const { data: session } = useSession();

  const adminSections = [
    {
      title: "SEO Dashboard",
      description: "Monitor website performance and search engine optimization metrics",
      icon: BarChart3,
      href: "/admin/dashboard",
      color: "bg-blue-500",
    },
    {
      title: "Tools Management",
      description: "Manage AI tools, rankings, and information",
      icon: FileText,
      href: "/admin/tools",
      color: "bg-green-500",
      disabled: false,
    },
    {
      title: "Analytics",
      description: "View detailed analytics and user engagement metrics",
      icon: TrendingUp,
      href: "/admin/analytics",
      color: "bg-purple-500",
      disabled: true,
    },
    {
      title: "Settings",
      description: "Configure site settings and preferences",
      icon: Settings,
      href: "/admin/settings",
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
          return (
            <Card
              key={section.title}
              className={`transition-all hover:shadow-lg ${
                section.disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
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
                <p className="text-muted-foreground mb-4">{section.description}</p>
                <Button
                  asChild={!section.disabled}
                  disabled={section.disabled}
                  className="w-full"
                  variant={section.disabled ? "secondary" : "default"}
                >
                  {section.disabled ? (
                    <span>Coming Soon</span>
                  ) : (
                    <Link href={section.href}>Access {section.title}</Link>
                  )}
                </Button>
              </CardContent>
            </Card>
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
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">SEO & Tools Management</p>
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
