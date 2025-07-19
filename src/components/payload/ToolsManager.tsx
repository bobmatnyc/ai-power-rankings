"use client";

import { useEffect, useState } from "react";

interface Tool {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  info?: {
    product?: {
      description?: string;
    };
  };
}

interface Ranking {
  id: string;
  tool: string;
  position: number;
  score: number;
  period: string;
}

export const ToolsManager: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const fetchData = async () => {
    try {
      const [toolsRes, rankingsRes] = await Promise.all([
        fetch("/api/tools?limit=100"),
        fetch("/api/rankings?limit=100"),
      ]);

      const toolsData = await toolsRes.json();
      const rankingsData = await rankingsRes.json();

      setTools(toolsData.docs || []);
      setRankings(rankingsData.docs || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getLatestRanking = (toolId: string) => {
    return rankings
      .filter((r) => r.tool === toolId)
      .sort((a, b) => b.period.localeCompare(a.period))[0];
  };

  const categories = [...new Set(tools.map((t) => t.category))];

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.info?.product?.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading tools...</div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>
        Tools Management
      </h1>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
          marginBottom: "25px",
        }}
      >
        <div
          style={{
            padding: "15px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#3b82f6" }}>
            {tools.length}
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>Total Tools</div>
        </div>
        <div
          style={{
            padding: "15px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#10b981" }}>
            {categories.length}
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>Categories</div>
        </div>
        <div
          style={{
            padding: "15px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#f59e0b" }}>
            {rankings.length}
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>Rankings</div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "15px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search tools..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            minWidth: "250px",
          }}
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Tools Table */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#f8fafc" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Tool
              </th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Category
              </th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Ranking
              </th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Score
              </th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTools.map((tool, index) => {
              const ranking = getLatestRanking(tool.id);
              return (
                <tr
                  key={tool.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <td style={{ padding: "12px" }}>
                    <div>
                      <div style={{ fontWeight: "bold", marginBottom: "2px" }}>{tool.name}</div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{tool.slug}</div>
                      {tool.info?.product?.description && (
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {tool.info.product.description.substring(0, 60)}...
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#e0e7ff",
                        color: "#3730a3",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      {tool.category}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    {ranking ? (
                      <span style={{ fontWeight: "bold" }}>#{ranking.position}</span>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {ranking ? (
                      <span>{ranking.score.toFixed(1)}</span>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        backgroundColor: tool.status === "active" ? "#dcfce7" : "#f3f4f6",
                        color: tool.status === "active" ? "#166534" : "#374151",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      {tool.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredTools.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#64748b",
          }}
        >
          No tools found matching your criteria
        </div>
      )}
    </div>
  );
};
