import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { 
  Package, 
  TrendingUp, 
  Newspaper, 
  Mail, 
  Activity,
  Eye,
  Calendar
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

async function getDashboardStats() {
  const supabase = await createClient();

  // Get counts for various entities
  const [tools, rankings, news, subscribers] = await Promise.all([
    supabase.from("tools").select("*", { count: "exact", head: true }),
    supabase.from("rankings").select("*", { count: "exact", head: true }),
    supabase.from("news_items").select("*", { count: "exact", head: true }),
    supabase.from("newsletter_subscribers").select("*", { count: "exact", head: true }).eq("verified", true),
  ]);

  // Get recent activity
  const { data: recentNews } = await supabase
    .from("news_items")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(5);

  const { data: latestRanking } = await supabase
    .from("rankings")
    .select("period")
    .order("period", { ascending: false })
    .limit(1)
    .single();

  return {
    toolsCount: tools.count || 0,
    rankingsCount: rankings.count || 0,
    newsCount: news.count || 0,
    subscribersCount: subscribers.count || 0,
    recentNews: recentNews || [],
    latestRankingPeriod: latestRanking?.period || null,
  };
}

export default async function AdminDashboard() {
  const session = await auth();
  const stats = await getDashboardStats();

  const statCards = [
    {
      title: "Total Tools",
      value: stats.toolsCount,
      icon: Package,
      href: "/admin/tools",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Ranking Periods",
      value: stats.rankingsCount,
      icon: TrendingUp,
      href: "/admin/rankings",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "News Articles",
      value: stats.newsCount,
      icon: Newspaper,
      href: "/admin/news",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Subscribers",
      value: stats.subscribersCount,
      icon: Mail,
      href: "/admin/newsletter",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {(session?.user as any)?.name || (session?.user as any)?.email}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value.toLocaleString()}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent News
            </h2>
            <Link href="/admin/news" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentNews.length > 0 ? (
              stats.recentNews.map((item) => (
                <div key={item.id} className="border-b pb-3 last:border-0">
                  <h3 className="font-medium text-sm line-clamp-1">{item.title}</h3>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {item.source}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.published_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No recent news items</p>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/admin/tools/new"
              className="block w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium">Add New Tool</p>
                  <p className="text-sm text-gray-600">Create a new AI tool entry</p>
                </div>
              </div>
            </Link>
            
            <Link
              href="/admin/news/new"
              className="block w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
            >
              <div className="flex items-center gap-3">
                <Newspaper className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium">Create News Article</p>
                  <p className="text-sm text-gray-600">Add a new news item</p>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/rankings/generate"
              className="block w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium">Generate Rankings</p>
                  <p className="text-sm text-gray-600">
                    Create new ranking period
                    {stats.latestRankingPeriod && (
                      <span className="text-xs"> (Latest: {stats.latestRankingPeriod})</span>
                    )}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}