import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload-direct";
import { logger } from "@/lib/logger";

interface OrphanedMetric {
  id: string;
  metric_key: string;
  value_display?: string;
  recorded_at: string;
  supabase_metric_id?: string;
  tool?: any;
  createdAt: string;
  updatedAt: string;
}

interface MetricAnalysis {
  totalMetrics: number;
  orphanedMetrics: OrphanedMetric[];
  orphanedCount: number;
  metricsWithInvalidTools: OrphanedMetric[];
  invalidToolsCount: number;
  metricsByKey: Record<string, number>;
  summary: {
    hasOrphans: boolean;
    hasInvalidTools: boolean;
    totalIssues: number;
  };
}

export async function GET(_request: NextRequest) {
  try {
    const payload = await getPayloadClient();
    logger.info("Checking for orphaned metrics...");

    // Get all metrics without pagination limits
    const allMetrics = await payload.find({
      collection: "metrics",
      limit: 100000, // Get all metrics
      depth: 1, // Populate tool relationships
    });

    const orphanedMetrics: OrphanedMetric[] = [];
    const metricsWithInvalidTools: OrphanedMetric[] = [];
    const metricsByKey: Record<string, number> = {};

    // Check each metric
    for (const metric of allMetrics.docs) {
      // Track metrics by key
      if (metric.metric_key) {
        metricsByKey[metric.metric_key] = (metricsByKey[metric.metric_key] || 0) + 1;
      }

      // Check if tool is missing or null
      if (!metric.tool) {
        orphanedMetrics.push(metric as OrphanedMetric);
        continue;
      }

      // Check if tool is an ID but the tool doesn't exist
      if (typeof metric.tool === "string") {
        try {
          const tool = await payload.findByID({
            collection: "tools",
            id: metric.tool,
          });
          if (!tool) {
            metricsWithInvalidTools.push({
              ...metric,
              tool: metric.tool, // Keep the invalid ID
            } as OrphanedMetric);
          }
        } catch (error) {
          // Tool lookup failed - invalid tool ID
          metricsWithInvalidTools.push({
            ...metric,
            tool: metric.tool,
          } as OrphanedMetric);
        }
      }
    }

    // Sort orphaned metrics by date for easier analysis
    orphanedMetrics.sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    );

    metricsWithInvalidTools.sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    );

    const analysis: MetricAnalysis = {
      totalMetrics: allMetrics.totalDocs,
      orphanedMetrics,
      orphanedCount: orphanedMetrics.length,
      metricsWithInvalidTools,
      invalidToolsCount: metricsWithInvalidTools.length,
      metricsByKey,
      summary: {
        hasOrphans: orphanedMetrics.length > 0,
        hasInvalidTools: metricsWithInvalidTools.length > 0,
        totalIssues: orphanedMetrics.length + metricsWithInvalidTools.length,
      },
    };

    logger.info(`Metric analysis complete: ${analysis.summary.totalIssues} issues found`);

    return NextResponse.json(analysis);
  } catch (error) {
    logger.error("Error checking orphaned metrics:", error);
    return NextResponse.json(
      {
        error: "Failed to check orphaned metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: Add a POST endpoint to fix orphaned metrics
export async function POST(request: NextRequest) {
  try {
    const { action, metricIds, targetToolId } = await request.json();
    const payload = await getPayloadClient();

    if (action === "delete") {
      // Delete orphaned metrics
      const results = [];
      for (const id of metricIds) {
        try {
          await payload.delete({
            collection: "metrics",
            id,
          });
          results.push({ id, status: "deleted" });
        } catch (error) {
          results.push({
            id,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      return NextResponse.json({ action: "delete", results });
    }

    if (action === "assign" && targetToolId) {
      // Assign orphaned metrics to a specific tool
      const results = [];
      for (const id of metricIds) {
        try {
          await payload.update({
            collection: "metrics",
            id,
            data: {
              tool: targetToolId,
            },
          });
          results.push({ id, status: "assigned", toolId: targetToolId });
        } catch (error) {
          results.push({
            id,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      return NextResponse.json({ action: "assign", results });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'delete' or 'assign' with appropriate parameters." },
      { status: 400 }
    );
  } catch (error) {
    logger.error("Error fixing orphaned metrics:", error);
    return NextResponse.json(
      {
        error: "Failed to fix orphaned metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
