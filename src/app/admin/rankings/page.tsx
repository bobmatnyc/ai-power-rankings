import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, TrendingUp } from "lucide-react";
import Link from "next/link";

async function getRankingPeriods() {
  const supabase = await createClient();
  
  const { data: rankings, error } = await supabase
    .from("rankings")
    .select("period")
    .order("period", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching rankings:", error);
    return [];
  }

  // Group periods and count tools manually
  const grouped = rankings?.reduce((acc: any[], ranking) => {
    const existing = acc.find(item => item.period === ranking.period);
    if (existing) {
      existing.tool_count += 1;
    } else {
      acc.push({ period: ranking.period, tool_count: 1 });
    }
    return acc;
  }, []);

  return grouped || [];
}

export default async function RankingsManagementPage() {
  const session = await auth();
  const rankingPeriods = await getRankingPeriods();

  const canEdit = (session?.user as any)?.role === "super_admin" || (session?.user as any)?.role === "editor";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rankings Management</h1>
          <p className="text-gray-600">Manage ranking periods and algorithm settings</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/rankings/settings">
                <Settings className="h-4 w-4 mr-2" />
                Algorithm Settings
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/rankings/generate">
                <Plus className="h-4 w-4 mr-2" />
                Generate Rankings
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Periods</div>
          <div className="text-2xl font-bold">{rankingPeriods.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Latest Period</div>
          <div className="text-2xl font-bold text-blue-600">
            {rankingPeriods[0]?.period || "None"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Avg Tools/Period</div>
          <div className="text-2xl font-bold text-green-600">
            {rankingPeriods.length > 0 
              ? Math.round(rankingPeriods.reduce((sum, p) => sum + (p.tool_count || 0), 0) / rankingPeriods.length)
              : 0
            }
          </div>
        </Card>
      </div>

      {/* Ranking Periods */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Ranking Periods
          </h2>
          
          {rankingPeriods.length > 0 ? (
            <div className="space-y-4">
              {rankingPeriods.map((period) => (
                <div key={period.period} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{period.period}</h3>
                    <p className="text-sm text-gray-600">
                      {period.tool_count} tools ranked
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Active</Badge>
                    {canEdit && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/rankings/${period.period}`}>
                          View Details
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ranking periods found</p>
              {canEdit && (
                <Button className="mt-4" asChild>
                  <Link href="/admin/rankings/generate">
                    Generate First Rankings
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}