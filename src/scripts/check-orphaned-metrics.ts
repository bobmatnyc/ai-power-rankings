#!/usr/bin/env node

/**
 * Script to check for orphaned metrics in the system
 *
 * Usage:
 *   npm run check-orphaned-metrics
 *
 * This script calls the API endpoint to check for:
 * 1. Metrics without any tool relationship
 * 2. Metrics with invalid tool IDs
 */

import { logger } from "@/lib/logger";

async function checkOrphanedMetrics() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/admin/check-orphaned-metrics`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    logger.info("=== Orphaned Metrics Analysis ===");
    logger.info(`Total metrics in system: ${data.totalMetrics}`);
    logger.info(`Orphaned metrics (no tool): ${data.orphanedCount}`);
    logger.info(`Metrics with invalid tools: ${data.invalidToolsCount}`);
    logger.info(`Total issues: ${data.summary.totalIssues}`);

    if (data.orphanedCount > 0) {
      logger.warn("\n--- Orphaned Metrics (no tool relationship) ---");
      data.orphanedMetrics.slice(0, 10).forEach((metric: unknown) => {
        logger.warn(`- ID: ${metric.id}`);
        logger.warn(`  Key: ${metric.metric_key}`);
        logger.warn(`  Value: ${metric.value_display}`);
        logger.warn(`  Recorded: ${metric.recorded_at}`);
        if (metric.supabase_metric_id) {
          logger.warn(`  Supabase ID: ${metric.supabase_metric_id}`);
        }
      });
      if (data.orphanedCount > 10) {
        logger.warn(`... and ${data.orphanedCount - 10} more orphaned metrics`);
      }
    }

    if (data.invalidToolsCount > 0) {
      logger.warn("\n--- Metrics with Invalid Tool IDs ---");
      data.metricsWithInvalidTools.slice(0, 10).forEach((metric: unknown) => {
        logger.warn(`- ID: ${metric.id}`);
        logger.warn(`  Key: ${metric.metric_key}`);
        logger.warn(`  Invalid Tool ID: ${metric.tool}`);
        logger.warn(`  Value: ${metric.value_display}`);
        logger.warn(`  Recorded: ${metric.recorded_at}`);
      });
      if (data.invalidToolsCount > 10) {
        logger.warn(`... and ${data.invalidToolsCount - 10} more metrics with invalid tools`);
      }
    }

    // Show metrics grouped by key
    logger.info("\n--- Metrics by Key ---");
    const sortedKeys = Object.entries(data.metricsByKey)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 20);

    sortedKeys.forEach(([key, count]) => {
      logger.info(`${key}: ${count} metrics`);
    });

    if (data.summary.totalIssues === 0) {
      logger.success("\n✅ No orphaned metrics found! All metrics have valid tool relationships.");
    } else {
      logger.warn(
        `\n⚠️  Found ${data.summary.totalIssues} metrics with issues that need attention.`
      );
      logger.info("\nTo fix these issues, you can:");
      logger.info(
        '1. DELETE orphaned metrics: POST to /api/admin/check-orphaned-metrics with { action: "delete", metricIds: [...] }'
      );
      logger.info(
        '2. ASSIGN to a tool: POST to /api/admin/check-orphaned-metrics with { action: "assign", metricIds: [...], targetToolId: "..." }'
      );
    }
  } catch (error) {
    logger.error("Failed to check orphaned metrics:", error);
    process.exit(1);
  }
}

// Run the check
checkOrphanedMetrics();
