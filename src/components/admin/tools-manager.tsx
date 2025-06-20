"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Search,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Filter,
  Download,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useSupabase } from "@/hooks/use-supabase";
import { Tool } from "@/types/database";

interface ToolWithRanking extends Tool {
  latest_ranking?: {
    position: number;
    position_change: number;
    score: number;
    period: string;
  };
}

export function ToolsManager() {
  const { tools, rankings, loading, fetchTools, fetchRankings } = useSupabase();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [, setSelectedTool] = useState<Tool | null>(null);
  const [, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    fetchTools();
    fetchRankings();
  }, [fetchTools, fetchRankings]);

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.info?.product?.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(tools.map((t) => t.category)));

  const getLatestRanking = (toolId: string): ToolWithRanking["latest_ranking"] => {
    const toolRankings = rankings
      .filter((r) => r.tool_id === toolId)
      .sort((a, b) => b.period.localeCompare(a.period));

    if (toolRankings.length === 0) {
      return undefined;
    }

    const latest = toolRankings[0];
    const previous = toolRankings[1];

    return {
      position: latest?.position || 0,
      position_change: previous ? (previous.position || 0) - (latest?.position || 0) : 0,
      score: latest?.score || 0,
      period: latest?.period || "",
    };
  };

  const handleEditTool = (tool: Tool) => {
    setSelectedTool(tool);
    setIsEditModalOpen(true);
  };

  const handleDeleteTool = async (toolId: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm("Are you sure you want to delete this tool?")) {
      return;
    }

    // TODO: Implement delete functionality
    console.log("Delete tool:", toolId);
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
          <h1 className="text-3xl font-bold">Tools Management</h1>
          <p className="text-muted-foreground">Manage AI tools, rankings, and information</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Tool
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tools.length}</div>
            <p className="text-xs text-muted-foreground">Active in database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">Tool categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Latest Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rankings.length > 0 ? rankings[0]?.period : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Most recent period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rankings.length > 0
                ? (rankings.reduce((sum, r) => sum + r.score, 0) / rankings.length).toFixed(1)
                : "0"}
            </div>
            <p className="text-xs text-muted-foreground">Across all tools</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="all-tools" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all-tools">All Tools</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="all-tools" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedCategory || ""}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Tools Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Latest Ranking</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Loading tools...
                    </TableCell>
                  </TableRow>
                ) : filteredTools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No tools found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTools.map((tool) => {
                    const ranking = getLatestRanking(tool.id);
                    return (
                      <TableRow key={tool.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{tool.name}</div>
                            {tool.info?.product?.description && (
                              <div className="text-sm text-muted-foreground">
                                {tool.info.product.description.substring(0, 50)}...
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tool.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {ranking ? (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">#{ranking.position}</span>
                              {ranking.position_change !== 0 && (
                                <div
                                  className={`flex items-center gap-1 text-sm ${
                                    ranking.position_change > 0 ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {ranking.position_change > 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  <span>{Math.abs(ranking.position_change)}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {ranking ? (
                            <div className="font-medium">{ranking.score.toFixed(1)}</div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tool.status === "active" ? "default" : "secondary"}>
                            {tool.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleEditTool(tool)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTool(tool.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="rankings">
          <Card>
            <CardHeader>
              <CardTitle>Rankings Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Rankings management interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Categories Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Categories management interface coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
