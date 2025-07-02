#!/usr/bin/env node

/**
 * Performance Audit Script for T-040
 *
 * Runs Lighthouse audit to measure mobile performance
 * and check Core Web Vitals compliance.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require("child_process");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

// Configuration
const DEFAULT_URL = "http://localhost:3000/en";

// Core Web Vitals thresholds for T-040
const THRESHOLDS = {
  LCP: 2500, // Largest Contentful Paint (ms)
  CLS: 0.1, // Cumulative Layout Shift
  FID: 100, // First Input Delay (ms)
  FCP: 1800, // First Contentful Paint (ms)
  TTI: 3500, // Time to Interactive (ms)
  TBT: 300, // Total Blocking Time (ms)
  SI: 3400, // Speed Index (ms)
};

function checkLighthouseInstalled() {
  try {
    // Check for local installation first
    const localPath = path.join(process.cwd(), "node_modules", ".bin", "lighthouse");
    if (fs.existsSync(localPath)) {
      return localPath;
    }

    // Check global installation
    execSync("lighthouse --version", { stdio: "pipe" });
    return "lighthouse";
  } catch {
    console.error("❌ Lighthouse is not installed.");
    console.log("📦 Install with: npm install --save-dev lighthouse");
    return false;
  }
}

function runLighthouseAudit(url, lighthousePath) {
  console.log(`🔍 Running Lighthouse audit for: ${url}`);
  console.log("📱 Mobile performance audit (T-040 focus)");

  const outputPath = path.join(process.cwd(), "lighthouse-report.json");

  try {
    // Run Lighthouse with mobile configuration
    const command = [
      lighthousePath,
      url,
      "--output=json",
      `--output-path=${outputPath}`,
      "--form-factor=mobile",
      "--throttling-method=simulate",
      '--chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"',
      "--quiet",
    ].join(" ");

    console.log("⏳ Running audit...");
    execSync(command, { stdio: "pipe" });

    // Read and parse results
    const reportData = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    return reportData;
  } catch (error) {
    console.error("❌ Lighthouse audit failed:", error.message);
    return null;
  }
}

function analyzeResults(report) {
  if (!report) return;

  const audits = report.audits;
  const categories = report.categories;

  console.log("\n📊 PERFORMANCE AUDIT RESULTS (T-040)");
  console.log("=====================================");

  // Overall Performance Score
  const perfScore = Math.round(categories.performance.score * 100);
  const perfStatus = perfScore >= 90 ? "✅" : perfScore >= 70 ? "⚠️" : "❌";
  console.log(`${perfStatus} Performance Score: ${perfScore}/100`);

  console.log("\n🎯 CORE WEB VITALS (T-040 Targets)");
  console.log("==================================");

  // Core Web Vitals Analysis
  const metrics = {
    LCP: {
      value: audits["largest-contentful-paint"]?.numericValue,
      threshold: THRESHOLDS.LCP,
      unit: "ms",
      description: "Largest Contentful Paint",
    },
    CLS: {
      value: audits["cumulative-layout-shift"]?.numericValue,
      threshold: THRESHOLDS.CLS,
      unit: "",
      description: "Cumulative Layout Shift",
    },
    FCP: {
      value: audits["first-contentful-paint"]?.numericValue,
      threshold: THRESHOLDS.FCP,
      unit: "ms",
      description: "First Contentful Paint",
    },
    TTI: {
      value: audits["interactive"]?.numericValue,
      threshold: THRESHOLDS.TTI,
      unit: "ms",
      description: "Time to Interactive",
    },
    TBT: {
      value: audits["total-blocking-time"]?.numericValue,
      threshold: THRESHOLDS.TBT,
      unit: "ms",
      description: "Total Blocking Time",
    },
    SI: {
      value: audits["speed-index"]?.numericValue,
      threshold: THRESHOLDS.SI,
      unit: "ms",
      description: "Speed Index",
    },
  };

  let passedMetrics = 0;
  const totalMetrics = Object.keys(metrics).length;

  Object.entries(metrics).forEach(([key, metric]) => {
    if (metric.value !== undefined) {
      const passed = metric.value <= metric.threshold;
      const status = passed ? "✅" : "❌";
      const value =
        metric.unit === "ms" ? `${Math.round(metric.value)}ms` : metric.value.toFixed(3);
      const threshold = metric.unit === "ms" ? `${metric.threshold}ms` : metric.threshold;

      console.log(`${status} ${key}: ${value} (target: <${threshold}) - ${metric.description}`);

      if (passed) passedMetrics++;
    }
  });

  console.log(`\n📈 Core Web Vitals: ${passedMetrics}/${totalMetrics} passed`);

  // T-040 Specific Issues
  console.log("\n🔧 T-040 SPECIFIC ANALYSIS");
  console.log("==========================");

  // Layout Shift Analysis
  const clsValue = metrics.CLS.value;
  if (clsValue > THRESHOLDS.CLS) {
    console.log(`❌ Layout Shift Issue: ${clsValue.toFixed(3)} (target: <${THRESHOLDS.CLS})`);
    console.log("   → Check stats grid components for explicit dimensions");
    console.log("   → Ensure skeleton loading states are working");
  } else {
    console.log(`✅ Layout Shift: ${clsValue.toFixed(3)} (within target)`);
  }

  // Image Optimization
  const imageOptimization = audits["uses-optimized-images"]?.details?.items || [];

  if (imageOptimization.length > 0) {
    console.log("❌ Image Optimization Issues:");
    imageOptimization.forEach((item) => {
      console.log(`   → ${item.url}: ${Math.round(item.wastedBytes / 1024)}KB savings`);
    });
  } else {
    console.log("✅ Image Optimization: All images optimized");
  }

  // Mobile Performance Summary
  console.log("\n📱 MOBILE PERFORMANCE SUMMARY");
  console.log("=============================");

  const t040Status = perfScore >= 90 && clsValue <= THRESHOLDS.CLS;
  console.log(`${t040Status ? "✅" : "❌"} T-040 Status: ${t040Status ? "PASSED" : "NEEDS WORK"}`);

  if (!t040Status) {
    console.log("\n🛠️  RECOMMENDED ACTIONS:");
    if (perfScore < 90) {
      console.log("   • Optimize JavaScript bundles");
      console.log("   • Implement code splitting");
      console.log("   • Defer non-critical resources");
    }
    if (clsValue > THRESHOLDS.CLS) {
      console.log("   • Fix layout shifts in stats components");
      console.log("   • Add explicit dimensions to dynamic content");
    }
  }

  return {
    performanceScore: perfScore,
    coreWebVitals: metrics,
    t040Passed: t040Status,
  };
}

function main() {
  const url = process.argv[2] || DEFAULT_URL;

  console.log("🚀 T-040 Mobile Performance Audit");
  console.log("==================================");

  const lighthousePath = checkLighthouseInstalled();
  if (!lighthousePath) {
    process.exit(1);
  }

  const report = runLighthouseAudit(url, lighthousePath);
  const results = analyzeResults(report);

  // Clean up report file
  const reportPath = path.join(process.cwd(), "lighthouse-report.json");
  if (fs.existsSync(reportPath)) {
    fs.unlinkSync(reportPath);
  }

  // Exit with appropriate code
  if (results && results.t040Passed) {
    console.log("\n🎉 T-040 requirements met!");
    process.exit(0);
  } else {
    console.log("\n⚠️  T-040 requirements not yet met");
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runLighthouseAudit, analyzeResults };
