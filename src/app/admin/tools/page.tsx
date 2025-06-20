import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Eye, Trash2 } from "lucide-react";
import Link from "next/link";

async function getTools() {
  const supabase = await createClient();
  
  const { data: tools, error } = await supabase
    .from("tools")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching tools:", error);
    return [];
  }

  return tools || [];
}

export default async function ToolsManagementPage() {
  const session = await auth();
  const tools = await getTools();

  const canEdit = (session?.user as any)?.role === "super_admin" || (session?.user as any)?.role === "editor";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tools Management</h1>
          <p className="text-gray-600">Manage AI coding tools in the database</p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/admin/tools/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Tool
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Tools</div>
          <div className="text-2xl font-bold">{tools.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Active</div>
          <div className="text-2xl font-bold text-green-600">
            {tools.filter(t => t.status === "active").length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Inactive</div>
          <div className="text-2xl font-bold text-red-600">
            {tools.filter(t => t.status === "inactive").length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Categories</div>
          <div className="text-2xl font-bold">
            {new Set(tools.map(t => t.category)).size}
          </div>
        </Card>
      </div>

      {/* Tools Table */}
      <Card>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Category</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Website</th>
                  <th className="text-left py-3 px-4 font-medium">Updated</th>
                  <th className="text-center py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr key={tool.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {tool.description}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">
                        {tool.category.replace(/-/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge 
                        variant={tool.status === "active" ? "default" : "destructive"}
                      >
                        {tool.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {tool.website_url ? (
                        <a 
                          href={tool.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {new URL(tool.website_url).hostname}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(tool.updated_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/tools/${tool.slug}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/admin/tools/${tool.id}/edit`}>
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