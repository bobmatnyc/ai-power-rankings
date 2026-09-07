"use client";

import { useCallback, useEffect, useState } from "react";
import { cacheBustFetch } from "@/lib/api/cache-busting";
import {
  buildDashboardStats,
  type DashboardStats,
  type NewsListResponse,
  type RankingsResponse,
  type SubscribersResponse,
  type ToolsListResponse,
} from "./admin-dashboard-stats";

const EMPTY_STATS: DashboardStats = {
  totalTools: null,
  totalRankings: null,
  totalNews: null,
  totalSubscribers: null,
  latestPeriod: null,
  lastPublishedAt: null,
};

/**
 * Reads one endpoint, resolving to `null` instead of throwing.
 *
 * Why: the four fetches shared one `try`, so a single failure took all four
 * counts down with it — and `/api/admin/subscribers` has no route, so its 404
 * answers with an HTML body that `.json()` always threw on. Every card read 0
 * as a result (#140 follow-up). The `res.ok` check also stops a 500/503 error
 * payload from being parsed as a stats body.
 * What: resolves to the parsed body, or `null` on a network error, a non-2xx
 * status, or a body that is not JSON.
 * Test: `tests/unit/admin-dashboard-stats.test.ts` covers what a `null` here
 * renders as.
 */
async function readJson<T>(send: () => Promise<Response>): Promise<T | null> {
  try {
    const response = await send();
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.error("Dashboard stat fetch failed:", error);
    return null;
  }
}

/** Formats an ISO timestamp for display, or "N/A" when there is none. */
function formatDay(iso: string | null): string {
  if (!iso) return "N/A";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleDateString();
}

/** Renders a count, or an em dash when the fetch behind it failed. */
function renderCount(count: number | null): string {
  return count === null ? "—" : String(count);
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    // #140 follow-up: each response is read independently, and each count comes
    // from the field its route actually returns — `total` for news, the tools
    // array length, `stats.total_tools` for rankings. All three previously read
    // `totalDocs`, which no route here emits.
    const [tools, rankings, news, subscribers] = await Promise.all([
      readJson<ToolsListResponse>(() => fetch("/api/tools")),
      readJson<RankingsResponse>(() => fetch("/api/rankings")),
      readJson<NewsListResponse>(() =>
        cacheBustFetch("/api/news?limit=1", {}, { timestamp: true })
      ),
      readJson<SubscribersResponse>(() => fetch("/api/admin/subscribers")),
    ]);

    setStats(buildDashboardStats({ tools, rankings, news, subscribers }));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading dashboard...</div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>
        AI Power Rankings Dashboard
      </h1>

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div
          style={{
            padding: "20px",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            backgroundColor: "#f8fafc",
          }}
        >
          <h3 style={{ fontSize: "14px", color: "#64748b", margin: "0 0 8px 0" }}>Total Tools</h3>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1e293b" }}>
            {renderCount(stats.totalTools)}
          </div>
        </div>

        <div
          style={{
            padding: "20px",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            backgroundColor: "#f8fafc",
          }}
        >
          <h3 style={{ fontSize: "14px", color: "#64748b", margin: "0 0 8px 0" }}>
            Total Rankings
          </h3>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1e293b" }}>
            {renderCount(stats.totalRankings)}
          </div>
        </div>

        <div
          style={{
            padding: "20px",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            backgroundColor: "#f8fafc",
          }}
        >
          <h3 style={{ fontSize: "14px", color: "#64748b", margin: "0 0 8px 0" }}>News Articles</h3>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1e293b" }}>
            {renderCount(stats.totalNews)}
          </div>
        </div>

        <div
          style={{
            padding: "20px",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            backgroundColor: "#f8fafc",
          }}
        >
          <h3 style={{ fontSize: "14px", color: "#64748b", margin: "0 0 8px 0" }}>Subscribers</h3>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1e293b" }}>
            {renderCount(stats.totalSubscribers)}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "15px" }}>
          System Status
        </h2>
        <div
          style={{
            padding: "20px",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ marginBottom: "10px" }}>
            <strong>Latest Ranking Period:</strong> {stats.latestPeriod ?? "N/A"}
          </div>
          <div style={{ marginBottom: "10px" }}>
            {/* #140 follow-up: this read `new Date()`, so it always showed today
                regardless of when the snapshot was published. */}
            <strong>Rankings Published:</strong> {formatDay(stats.lastPublishedAt)}
          </div>
          <div style={{ color: "#10b981", fontWeight: "bold" }}>✓ All systems operational</div>
        </div>
      </div>
    </div>
  );
};
