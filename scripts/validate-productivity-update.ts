/**
 * Validate Productivity Paradox Update Integration
 *
 * This script validates that all productivity paradox research findings
 * have been properly integrated into the ranking system.
 */

import fs from "node:fs";
import path from "node:path";
import { logger } from "../src/lib/logger";

interface ValidationResult {
  category: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: any;
}

/**
 * Main validation function
 */
async function validateProductivityUpdate(): Promise<void> {
  logger.info("Starting productivity paradox update validation");

  const results: ValidationResult[] = [];
  const dataDir = path.join(process.cwd(), "data");

  // 1. Validate news articles have impact assessment
  try {
    const newsPath = path.join(dataDir, "json", "news", "articles", "2025-07.json");
    const newsData = JSON.parse(fs.readFileSync(newsPath, "utf-8"));

    const productivityArticles = newsData.filter(
      (article: any) =>
        article.tags &&
        (article.tags.includes("METR study") ||
          article.tags.includes("productivity") ||
          article.tags.includes("developer perception"))
    );

    const articlesWithImpact = productivityArticles.filter(
      (article: any) => article.impact_assessment && article.metadata?.productivity_paradox_research
    );

    results.push({
      category: "News Integration",
      status: articlesWithImpact.length === productivityArticles.length ? "pass" : "fail",
      message: `${articlesWithImpact.length}/${productivityArticles.length} productivity articles have impact assessment`,
      details: {
        total_articles: productivityArticles.length,
        articles_with_impact: articlesWithImpact.length,
        articles: articlesWithImpact.map((a: any) => ({
          title: a.title,
          impact_type: a.impact_assessment?.importance,
          cognitive_bias_factor: a.metadata?.cognitive_bias_factor,
        })),
      },
    });
  } catch (error) {
    results.push({
      category: "News Integration",
      status: "fail",
      message: `Failed to validate news articles: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  // 2. Validate metrics have productivity adjustments
  try {
    const metricsPath = path.join(dataDir, "metrics-by-date", "metrics-latest.json");
    const metricsData = JSON.parse(fs.readFileSync(metricsPath, "utf-8"));

    const productivityEntries = metricsData.entries.filter(
      (entry: any) =>
        entry.source?.name === "METR_research_integration" &&
        entry.context?.research_impact === true
    );

    const affectedToolIds = ["1", "2", "26", "27"];
    const toolsWithAdjustments = productivityEntries.filter((entry: any) =>
      affectedToolIds.includes(entry.tool_id)
    );

    results.push({
      category: "Metrics Integration",
      status: toolsWithAdjustments.length === affectedToolIds.length ? "pass" : "fail",
      message: `${toolsWithAdjustments.length}/${affectedToolIds.length} affected tools have productivity adjustments`,
      details: {
        affected_tools: affectedToolIds,
        tools_with_adjustments: toolsWithAdjustments.map((e: any) => e.tool_id),
        adjustment_details: toolsWithAdjustments.map((e: any) => ({
          tool_id: e.tool_id,
          business_sentiment_adjustment: e.metrics.business_sentiment_adjustment?.value,
          market_impact: e.metrics.market_impact?.value,
          risk_factor: e.metrics.risk_factor_addition?.value,
        })),
      },
    });
  } catch (error) {
    results.push({
      category: "Metrics Integration",
      status: "fail",
      message: `Failed to validate metrics: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  // 3. Validate productivity-adjusted rankings exist
  try {
    const rankingsPath = path.join(
      dataDir,
      "json",
      "rankings",
      "periods",
      "2025-07-14-productivity-adjusted.json"
    );

    if (!fs.existsSync(rankingsPath)) {
      results.push({
        category: "Rankings Calculation",
        status: "fail",
        message: "Productivity-adjusted rankings file does not exist",
      });
    } else {
      const rankingsData = JSON.parse(fs.readFileSync(rankingsPath, "utf-8"));

      const adjustedTools = rankingsData.rankings.filter((r: any) => r.productivity_adjusted);

      results.push({
        category: "Rankings Calculation",
        status: adjustedTools.length === 4 ? "pass" : "warning",
        message: `${adjustedTools.length}/4 tools marked as productivity adjusted in rankings`,
        details: {
          algorithm_version: rankingsData.algorithm_version,
          total_tools: rankingsData.rankings.length,
          adjusted_tools: adjustedTools.map((r: any) => ({
            position: r.position,
            tool: r.tool_name,
            score: r.score,
            tier: r.tier,
          })),
        },
      });
    }
  } catch (error) {
    results.push({
      category: "Rankings Calculation",
      status: "fail",
      message: `Failed to validate rankings: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  // 4. Validate summary reports exist
  try {
    const summaryPath = path.join(dataDir, "productivity-paradox-impact-summary.json");
    const adjustedSummaryPath = path.join(dataDir, "productivity-adjusted-rankings-summary.json");

    const summaryExists = fs.existsSync(summaryPath);
    const adjustedSummaryExists = fs.existsSync(adjustedSummaryPath);

    if (summaryExists && adjustedSummaryExists) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
      const adjustedSummary = JSON.parse(fs.readFileSync(adjustedSummaryPath, "utf-8"));

      results.push({
        category: "Summary Reports",
        status: "pass",
        message: "Both summary reports generated successfully",
        details: {
          impact_summary: {
            tools_updated: summary.tools_updated.length,
            key_findings: summary.key_findings,
          },
          rankings_summary: {
            tools_calculated: adjustedSummary.tools_calculated,
            tools_with_adjustments: adjustedSummary.tools_with_adjustments,
            algorithm_version: adjustedSummary.algorithm_version,
          },
        },
      });
    } else {
      results.push({
        category: "Summary Reports",
        status: "fail",
        message: `Missing summary reports: impact=${summaryExists}, rankings=${adjustedSummaryExists}`,
      });
    }
  } catch (error) {
    results.push({
      category: "Summary Reports",
      status: "fail",
      message: `Failed to validate summaries: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  // 5. Validate backups were created
  try {
    const newsBackup = path.join(
      dataDir,
      "json",
      "news",
      "articles",
      "2025-07.json.backup-pre-productivity-update"
    );
    const metricsBackup = path.join(
      dataDir,
      "metrics-by-date",
      "metrics-latest.json.backup-pre-productivity-update"
    );

    const newsBackupExists = fs.existsSync(newsBackup);
    const metricsBackupExists = fs.existsSync(metricsBackup);

    results.push({
      category: "Backup Validation",
      status: newsBackupExists && metricsBackupExists ? "pass" : "warning",
      message: `Backups created: news=${newsBackupExists}, metrics=${metricsBackupExists}`,
      details: {
        news_backup: newsBackupExists,
        metrics_backup: metricsBackupExists,
      },
    });
  } catch (error) {
    results.push({
      category: "Backup Validation",
      status: "warning",
      message: `Failed to validate backups: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  // Generate validation report
  const validationReport = {
    validation_date: new Date().toISOString(),
    overall_status: results.every((r) => r.status === "pass")
      ? "PASS"
      : results.some((r) => r.status === "fail")
        ? "FAIL"
        : "WARNING",
    productivity_research_integration: "METR productivity paradox study July 2025",
    validation_results: results,
    summary: {
      total_checks: results.length,
      passed: results.filter((r) => r.status === "pass").length,
      failed: results.filter((r) => r.status === "fail").length,
      warnings: results.filter((r) => r.status === "warning").length,
    },
    recommendations: generateRecommendations(results),
  };

  const reportPath = path.join(dataDir, "productivity-update-validation-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(validationReport, null, 2));

  // Display results
  console.log("\n=== PRODUCTIVITY PARADOX UPDATE VALIDATION ===");
  console.log(`Overall Status: ${validationReport.overall_status}`);
  console.log("Research Integration: METR productivity paradox study");
  console.log(`Validation Date: ${new Date().toISOString()}`);

  console.log("\nValidation Results:");
  results.forEach((result) => {
    const icon = result.status === "pass" ? "✓" : result.status === "fail" ? "✗" : "⚠";
    console.log(`${icon} ${result.category}: ${result.message}`);
  });

  console.log("\nSummary:");
  console.log(`  Total Checks: ${validationReport.summary.total_checks}`);
  console.log(`  Passed: ${validationReport.summary.passed}`);
  console.log(`  Failed: ${validationReport.summary.failed}`);
  console.log(`  Warnings: ${validationReport.summary.warnings}`);

  if (validationReport.recommendations.length > 0) {
    console.log("\nRecommendations:");
    validationReport.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }

  console.log(`\nDetailed validation report saved to: ${reportPath}`);

  logger.info("Productivity paradox update validation completed", {
    overall_status: validationReport.overall_status,
    checks_performed: results.length,
    passed: validationReport.summary.passed,
    failed: validationReport.summary.failed,
    warnings: validationReport.summary.warnings,
  });
}

/**
 * Generate recommendations based on validation results
 */
function generateRecommendations(results: ValidationResult[]): string[] {
  const recommendations: string[] = [];

  const failedResults = results.filter((r) => r.status === "fail");
  const warningResults = results.filter((r) => r.status === "warning");

  if (failedResults.length > 0) {
    recommendations.push("Address all failed validation checks before deploying changes");

    failedResults.forEach((result) => {
      if (result.category === "News Integration") {
        recommendations.push("Update news articles with proper impact assessment metadata");
      }
      if (result.category === "Metrics Integration") {
        recommendations.push("Ensure all affected tools have productivity adjustment metrics");
      }
      if (result.category === "Rankings Calculation") {
        recommendations.push("Regenerate productivity-adjusted rankings file");
      }
    });
  }

  if (warningResults.length > 0) {
    recommendations.push("Review warning items for potential improvements");
  }

  if (results.some((r) => r.status === "pass" && r.category === "Rankings Calculation")) {
    recommendations.push("Consider setting new rankings as current after validation");
    recommendations.push("Update cache to reflect new ranking calculations");
    recommendations.push("Monitor for additional research validation or contradiction");
  }

  return recommendations;
}

// Run validation if called directly
if (require.main === module) {
  validateProductivityUpdate()
    .then(() => {
      console.log("✓ Productivity paradox update validation completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("✗ Validation failed:", error);
      process.exit(1);
    });
}

export default validateProductivityUpdate;
