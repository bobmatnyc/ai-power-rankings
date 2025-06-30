#!/usr/bin/env tsx
/**
 * Generate Tools Data Report
 * Creates a comprehensive report of all tools and missing data
 */

import { getToolsRepo, getCompaniesRepo } from "../lib/json-db";
import fs from "fs/promises";
import path from "path";

interface ToolReport {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  company_name: string;
  launch_date?: string;
  created_at: string;
  missing_fields: string[];
  metrics_available: string[];
  info_summary: {
    has_description: boolean;
    has_website: boolean;
    has_pricing: boolean;
    has_features: boolean;
    has_technical_info: boolean;
    has_business_info: boolean;
    has_metrics: boolean;
  };
}

async function generateToolsReport() {
  try {
    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();

    const tools = await toolsRepo.getAll();
    const companies = await companiesRepo.getAll();

    // Create company lookup
    const companyLookup = new Map(companies.map((c) => [c.id, c.name]));

    const reports: ToolReport[] = [];

    for (const tool of tools) {
      const missing_fields: string[] = [];
      const metrics_available: string[] = [];

      // Check missing core fields
      if (!tool.launch_date) missing_fields.push("launch_date");
      if (!tool.company_id) missing_fields.push("company_id");

      // Check info fields
      const info = tool.info || {};

      // Description
      if (!info.description || info.description.trim() === "") {
        missing_fields.push("description");
      }

      // Website
      if (!info.website || info.website.trim() === "") {
        missing_fields.push("website");
      }

      // Summary
      if (!info.summary || info.summary.trim() === "") {
        missing_fields.push("summary/tagline");
      }

      // Features
      if (!info.features || info.features.length === 0) {
        missing_fields.push("features");
      }

      // Technical info
      const technical = info.technical || {};
      if (Object.keys(technical).length === 0) {
        missing_fields.push("technical_info");
      } else {
        if (!technical.supported_languages) missing_fields.push("supported_languages");
        if (!technical.context_window) missing_fields.push("context_window");
        if (!technical.multi_file_support) missing_fields.push("multi_file_support");
        if (!technical.github_repo) missing_fields.push("github_repo");
      }

      // Business info
      const business = info.business || {};
      if (!business.pricing_model) {
        missing_fields.push("pricing_model");
      }

      // Metrics
      const metrics = info.metrics || {};
      if (Object.keys(metrics).length === 0) {
        missing_fields.push("ALL_metrics");
      } else {
        if (metrics.github_stars) metrics_available.push(`github_stars: ${metrics.github_stars}`);
        if (metrics.swe_bench_score)
          metrics_available.push(`swe_bench: ${metrics.swe_bench_score}%`);
        if (metrics.users) metrics_available.push(`users: ${metrics.users}`);
        if (metrics.revenue) metrics_available.push(`revenue: $${metrics.revenue}`);
        if (metrics.funding) metrics_available.push(`funding: $${metrics.funding}`);
        if (metrics.valuation) metrics_available.push(`valuation: $${metrics.valuation}`);

        // Check what's missing
        if (!metrics.swe_bench_score) missing_fields.push("swe_bench_score");
        if (!metrics.github_stars && tool.category === "open-source-framework")
          missing_fields.push("github_stars");
        if (!metrics.users && !metrics.estimated_users) missing_fields.push("user_metrics");
        if (!metrics.revenue && !metrics.arr && !metrics.monthly_arr)
          missing_fields.push("revenue_metrics");
      }

      const report: ToolReport = {
        id: tool.id,
        name: tool.name,
        slug: tool.slug,
        category: tool.category,
        status: tool.status,
        company_name: companyLookup.get(tool.company_id) || "Unknown Company",
        launch_date: tool.launch_date,
        created_at: tool.created_at,
        missing_fields,
        metrics_available,
        info_summary: {
          has_description: !!info.description && info.description.trim() !== "",
          has_website: !!info.website && info.website.trim() !== "",
          has_pricing: !!business.pricing_model,
          has_features: !!info.features && info.features.length > 0,
          has_technical_info: Object.keys(technical).length > 0,
          has_business_info: Object.keys(business).length > 0,
          has_metrics: Object.keys(metrics).length > 0,
        },
      };

      reports.push(report);
    }

    // Sort by number of missing fields (most missing first)
    reports.sort((a, b) => b.missing_fields.length - a.missing_fields.length);

    // Generate report
    console.log("# AI Power Rankings - Tools Data Report\n");
    console.log(`Generated: ${new Date().toISOString()}\n`);
    console.log(`Total Tools: ${reports.length}\n`);

    // Summary statistics
    const toolsWithLaunchDate = reports.filter((r) => r.launch_date).length;
    const toolsWithAllData = reports.filter((r) => r.missing_fields.length === 0).length;
    const toolsWithMetrics = reports.filter((r) => r.metrics_available.length > 0).length;

    console.log("## Summary Statistics\n");
    console.log(
      `- Tools with launch dates: ${toolsWithLaunchDate}/${reports.length} (${((toolsWithLaunchDate / reports.length) * 100).toFixed(1)}%)`
    );
    console.log(
      `- Tools with complete data: ${toolsWithAllData}/${reports.length} (${((toolsWithAllData / reports.length) * 100).toFixed(1)}%)`
    );
    console.log(
      `- Tools with metrics: ${toolsWithMetrics}/${reports.length} (${((toolsWithMetrics / reports.length) * 100).toFixed(1)}%)\n`
    );

    // Missing data summary
    const missingCounts = new Map<string, number>();
    reports.forEach((r) => {
      r.missing_fields.forEach((field) => {
        missingCounts.set(field, (missingCounts.get(field) || 0) + 1);
      });
    });

    console.log("## Most Common Missing Fields\n");
    const sortedMissing = Array.from(missingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sortedMissing.forEach(([field, count]) => {
      console.log(`- ${field}: ${count} tools (${((count / reports.length) * 100).toFixed(1)}%)`);
    });

    // Detailed report
    console.log("\n## Detailed Tool Reports\n");

    // Group by category
    const byCategory = new Map<string, ToolReport[]>();
    reports.forEach((r) => {
      const category = r.category;
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(r);
    });

    // Sort categories by name
    const sortedCategories = Array.from(byCategory.keys()).sort();

    for (const category of sortedCategories) {
      const categoryTools = byCategory.get(category)!;
      console.log(
        `### ${category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} (${categoryTools.length} tools)\n`
      );

      for (const tool of categoryTools) {
        console.log(`#### ${tool.name} (ID: ${tool.id})`);
        console.log(`- **Slug:** ${tool.slug}`);
        console.log(`- **Company:** ${tool.company_name}`);
        console.log(`- **Status:** ${tool.status}`);
        console.log(`- **Launch Date:** ${tool.launch_date || "❌ MISSING"}`);
        console.log(`- **Added to DB:** ${new Date(tool.created_at).toLocaleDateString()}`);

        if (tool.metrics_available.length > 0) {
          console.log(`- **Available Metrics:** ${tool.metrics_available.join(", ")}`);
        }

        if (tool.missing_fields.length > 0) {
          console.log(
            `- **Missing Data (${tool.missing_fields.length}):** ${tool.missing_fields.join(", ")}`
          );
        } else {
          console.log(`- **Data Status:** ✅ Complete`);
        }

        // Info summary
        const summary = [];
        if (tool.info_summary.has_description) summary.push("✓ Description");
        if (tool.info_summary.has_website) summary.push("✓ Website");
        if (tool.info_summary.has_pricing) summary.push("✓ Pricing");
        if (tool.info_summary.has_features) summary.push("✓ Features");
        if (tool.info_summary.has_technical_info) summary.push("✓ Technical");
        if (tool.info_summary.has_metrics) summary.push("✓ Metrics");

        if (summary.length > 0) {
          console.log(`- **Has:** ${summary.join(", ")}`);
        }

        console.log("");
      }
    }

    // Save to file
    const reportPath = path.join(process.cwd(), "reports", "tools-data-report.md");
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    // Redirect console output to string
    let reportContent = "";
    const originalLog = console.log;
    console.log = (msg: string) => {
      reportContent += msg + "\n";
    };

    // Re-run the report generation to capture output
    await generateReportContent();

    // Restore console.log
    console.log = originalLog;

    // Save report
    await fs.writeFile(reportPath, reportContent);
    console.log(`\n✅ Report saved to: ${reportPath}`);
  } catch (error) {
    console.error("Failed to generate report:", error);
    process.exit(1);
  }
}

async function generateReportContent() {
  const toolsRepo = getToolsRepo();
  const companiesRepo = getCompaniesRepo();

  const tools = await toolsRepo.getAll();
  const companies = await companiesRepo.getAll();

  const companyLookup = new Map(companies.map((c) => [c.id, c.name]));

  const reports: ToolReport[] = [];

  for (const tool of tools) {
    const missing_fields: string[] = [];
    const metrics_available: string[] = [];

    if (!tool.launch_date) missing_fields.push("launch_date");
    if (!tool.company_id) missing_fields.push("company_id");

    const info = tool.info || {};

    if (!info.description || info.description.trim() === "") {
      missing_fields.push("description");
    }

    if (!info.website || info.website.trim() === "") {
      missing_fields.push("website");
    }

    if (!info.summary || info.summary.trim() === "") {
      missing_fields.push("summary/tagline");
    }

    if (!info.features || info.features.length === 0) {
      missing_fields.push("features");
    }

    const technical = info.technical || {};
    if (Object.keys(technical).length === 0) {
      missing_fields.push("technical_info");
    }

    const business = info.business || {};
    if (!business.pricing_model) {
      missing_fields.push("pricing_model");
    }

    const metrics = info.metrics || {};
    if (Object.keys(metrics).length === 0) {
      missing_fields.push("ALL_metrics");
    }

    const report: ToolReport = {
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      category: tool.category,
      status: tool.status,
      company_name: companyLookup.get(tool.company_id) || "Unknown Company",
      launch_date: tool.launch_date,
      created_at: tool.created_at,
      missing_fields,
      metrics_available,
      info_summary: {
        has_description: !!info.description && info.description.trim() !== "",
        has_website: !!info.website && info.website.trim() !== "",
        has_pricing: !!business.pricing_model,
        has_features: !!info.features && info.features.length > 0,
        has_technical_info: Object.keys(technical).length > 0,
        has_business_info: Object.keys(business).length > 0,
        has_metrics: Object.keys(metrics).length > 0,
      },
    };

    reports.push(report);
  }

  reports.sort((a, b) => b.missing_fields.length - a.missing_fields.length);

  console.log("# AI Power Rankings - Tools Data Report\n");
  console.log(`Generated: ${new Date().toISOString()}\n`);
  console.log(`Total Tools: ${reports.length}\n`);

  const toolsWithLaunchDate = reports.filter((r) => r.launch_date).length;
  const toolsWithAllData = reports.filter((r) => r.missing_fields.length === 0).length;
  const toolsWithMetrics = reports.filter((r) => r.metrics_available.length > 0).length;

  console.log("## Summary Statistics\n");
  console.log(
    `- Tools with launch dates: ${toolsWithLaunchDate}/${reports.length} (${((toolsWithLaunchDate / reports.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `- Tools with complete data: ${toolsWithAllData}/${reports.length} (${((toolsWithAllData / reports.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `- Tools with metrics: ${toolsWithMetrics}/${reports.length} (${((toolsWithMetrics / reports.length) * 100).toFixed(1)}%)\n`
  );

  const missingCounts = new Map<string, number>();
  reports.forEach((r) => {
    r.missing_fields.forEach((field) => {
      missingCounts.set(field, (missingCounts.get(field) || 0) + 1);
    });
  });

  console.log("## Most Common Missing Fields\n");
  const sortedMissing = Array.from(missingCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  sortedMissing.forEach(([field, count]) => {
    console.log(`- ${field}: ${count} tools (${((count / reports.length) * 100).toFixed(1)}%)`);
  });

  console.log("\n## Detailed Tool Reports\n");

  const byCategory = new Map<string, ToolReport[]>();
  reports.forEach((r) => {
    const category = r.category;
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(r);
  });

  const sortedCategories = Array.from(byCategory.keys()).sort();

  for (const category of sortedCategories) {
    const categoryTools = byCategory.get(category)!;
    console.log(
      `### ${category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} (${categoryTools.length} tools)\n`
    );

    for (const tool of categoryTools) {
      console.log(`#### ${tool.name} (ID: ${tool.id})`);
      console.log(`- **Slug:** ${tool.slug}`);
      console.log(`- **Company:** ${tool.company_name}`);
      console.log(`- **Status:** ${tool.status}`);
      console.log(`- **Launch Date:** ${tool.launch_date || "❌ MISSING"}`);
      console.log(`- **Added to DB:** ${new Date(tool.created_at).toLocaleDateString()}`);

      if (tool.missing_fields.length > 0) {
        console.log(
          `- **Missing Data (${tool.missing_fields.length}):** ${tool.missing_fields.join(", ")}`
        );
      } else {
        console.log(`- **Data Status:** ✅ Complete`);
      }

      console.log("");
    }
  }
}

// Run if called directly
if (require.main === module) {
  generateToolsReport()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Report generation failed:", error);
      process.exit(1);
    });
}
