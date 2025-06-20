import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Eye, Trash2 } from "lucide-react";
import Link from "next/link";

async function getNewsItems() {
  const supabase = await createClient();
  
  const { data: news, error } = await supabase
    .from("news_items")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching news:", error);
    return [];
  }

  return news || [];
}

export default async function NewsManagementPage() {
  const session = await auth();
  const newsItems = await getNewsItems();

  const canEdit = (session?.user as any)?.role === "super_admin" || (session?.user as any)?.role === "editor";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">News Management</h1>
          <p className="text-gray-600">Manage news articles and updates</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/news/import">
                Import from Drive
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/news/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Article
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Articles</div>
          <div className="text-2xl font-bold">{newsItems.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">This Month</div>
          <div className="text-2xl font-bold text-blue-600">
            {newsItems.filter(item => {
              const itemDate = new Date(item.published_at);
              const now = new Date();
              return itemDate.getMonth() === now.getMonth() && 
                     itemDate.getFullYear() === now.getFullYear();
            }).length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Sources</div>
          <div className="text-2xl font-bold">
            {new Set(newsItems.map(item => item.source)).size}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Average/Week</div>
          <div className="text-2xl font-bold text-green-600">
            {Math.round(newsItems.length / 52)}
          </div>
        </Card>
      </div>

      {/* News Table */}
      <Card>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Title</th>
                  <th className="text-left py-3 px-4 font-medium">Source</th>
                  <th className="text-left py-3 px-4 font-medium">Region</th>
                  <th className="text-left py-3 px-4 font-medium">Published</th>
                  <th className="text-left py-3 px-4 font-medium">Impact</th>
                  <th className="text-center py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {newsItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium line-clamp-1">{item.title}</div>
                      <div className="text-sm text-gray-500 line-clamp-1">
                        {item.summary}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {item.source}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">
                        {item.region || "Global"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(item.published_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {item.impact_score ? (
                        <Badge 
                          variant={
                            item.impact_score > 0.7 ? "destructive" :
                            item.impact_score > 0.4 ? "default" : "secondary"
                          }
                        >
                          {(item.impact_score * 100).toFixed(0)}%
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={item.url} target="_blank">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/admin/news/${item.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}