#!/usr/bin/env node

/**
 * T-040 Compliance Checker
 *
 * Checks if T-040 mobile performance optimizations are properly implemented
 * without requiring Chrome/Lighthouse.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

// T-040 Requirements Checklist
const T040_REQUIREMENTS = {
  "Crown Image WebP Conversion": {
    check: () => {
      const webpExists = fs.existsSync("public/crown-of-technology.webp");
      const multiSizes = [
        fs.existsSync("public/crown-48.webp"),
        fs.existsSync("public/crown-64.webp"),
        fs.existsSync("public/crown-128.webp"),
      ];
      return webpExists && multiSizes.every((exists) => exists);
    },
    description: "Crown image converted to WebP with multiple sizes",
  },

  "OptimizedImage Component": {
    check: () => {
      const componentPath = "src/components/ui/optimized-image.tsx";
      if (!fs.existsSync(componentPath)) return false;

      const content = fs.readFileSync(componentPath, "utf8");
      return (
        content.includes("WebP") &&
        content.includes("CrownIcon") &&
        content.includes("ResponsiveCrownIcon")
      );
    },
    description: "OptimizedImage component with WebP support implemented",
  },

  "Stats Grid Layout Stability": {
    check: () => {
      const files = [
        "src/app/[lang]/client-rankings.tsx",
        "src/components/ranking/rankings-grid.tsx",
      ];

      return files.every((file) => {
        if (!fs.existsSync(file)) return false;
        const content = fs.readFileSync(file, "utf8");
        return (
          content.includes("minHeight") &&
          content.includes("stats-grid") &&
          content.includes("animate-pulse")
        );
      });
    },
    description: "Stats grid components have explicit dimensions and skeleton loading",
  },

  "Critical CSS Inlined": {
    check: () => {
      const layoutPath = "src/app/layout.tsx";
      if (!fs.existsSync(layoutPath)) return false;

      const content = fs.readFileSync(layoutPath, "utf8");
      return (
        content.includes("Critical CSS") &&
        content.includes(".stats-grid") &&
        content.includes("min-height: 120px")
      );
    },
    description: "Critical CSS for above-the-fold content inlined",
  },

  "Next.js Image Optimization": {
    check: () => {
      const configPath = "next.config.ts";
      if (!fs.existsSync(configPath)) return false;

      const content = fs.readFileSync(configPath, "utf8");
      return (
        content.includes("image/webp") &&
        content.includes("image/avif") &&
        content.includes("minimumCacheTTL: 31536000")
      );
    },
    description: "Next.js configured for WebP/AVIF with long cache TTL",
  },

  "Cache Headers Optimization": {
    check: () => {
      const middlewarePath = "src/middleware.ts";
      if (!fs.existsSync(middlewarePath)) return false;

      const content = fs.readFileSync(middlewarePath, "utf8");
      return (
        content.includes("max-age=31536000") &&
        content.includes("immutable") &&
        content.includes("T-040")
      );
    },
    description: "Middleware configured with optimized cache headers",
  },

  "Modern Browser Targeting": {
    check: () => {
      const configPath = "next.config.ts";
      if (!fs.existsSync(configPath)) return false;

      const content = fs.readFileSync(configPath, "utf8");
      return content.includes("swcMinify: true") && content.includes("optimizePackageImports");
    },
    description: "Modern browser targeting with SWC minification",
  },

  "Skeleton Loading States": {
    check: () => {
      const skeletonPath = "src/components/ui/skeleton.tsx";
      if (!fs.existsSync(skeletonPath)) return false;

      const content = fs.readFileSync(skeletonPath, "utf8");
      return content.includes("animate-pulse") && content.includes("RankingsTableSkeleton");
    },
    description: "Skeleton loading components implemented",
  },
};

function checkFileSize(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.statSync(filePath);
  return Math.round(stats.size / 1024); // KB
}

function analyzeImageOptimization() {
  console.log("\n📸 IMAGE OPTIMIZATION ANALYSIS");
  console.log("==============================");

  const originalPng = checkFileSize("public/crown-of-technology.png");
  const optimizedWebp = checkFileSize("public/crown-of-technology.webp");

  if (originalPng && optimizedWebp) {
    const savings = originalPng - optimizedWebp;
    const savingsPercent = Math.round((savings / originalPng) * 100);

    console.log(`✅ PNG: ${originalPng}KB → WebP: ${optimizedWebp}KB`);
    console.log(`💾 Savings: ${savings}KB (${savingsPercent}% reduction)`);

    if (savingsPercent > 90) {
      console.log("🎉 Excellent optimization! >90% size reduction");
    } else if (savingsPercent > 70) {
      console.log("✅ Good optimization! >70% size reduction");
    } else {
      console.log("⚠️  Could be better optimized");
    }
  } else {
    console.log("❌ Could not analyze image sizes");
  }

  // Check responsive sizes
  const sizes = ["48", "64", "128"];
  const responsiveSizes = sizes.map((size) => {
    const exists = fs.existsSync(`public/crown-${size}.webp`);
    const fileSize = exists ? checkFileSize(`public/crown-${size}.webp`) : null;
    return { size, exists, fileSize };
  });

  console.log("\n📱 Responsive Image Sizes:");
  responsiveSizes.forEach(({ size, exists, fileSize }) => {
    const status = exists ? "✅" : "❌";
    const sizeInfo = fileSize ? ` (${fileSize}KB)` : "";
    console.log(`${status} ${size}x${size}px${sizeInfo}`);
  });
}

function checkLayoutShiftPrevention() {
  console.log("\n📐 LAYOUT SHIFT PREVENTION");
  console.log("==========================");

  const statsComponents = [
    "src/app/[lang]/client-rankings.tsx",
    "src/components/ranking/rankings-grid.tsx",
  ];

  statsComponents.forEach((file) => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");

      // Check for explicit dimensions
      const hasMinHeight = content.includes("minHeight");
      const hasSkeletonLoading = content.includes("animate-pulse");
      const hasStatsGrid = content.includes("stats-grid");

      console.log(`\n📄 ${path.basename(file)}:`);
      console.log(`${hasMinHeight ? "✅" : "❌"} Explicit dimensions (minHeight)`);
      console.log(`${hasSkeletonLoading ? "✅" : "❌"} Skeleton loading states`);
      console.log(`${hasStatsGrid ? "✅" : "❌"} Stats grid class applied`);

      if (hasMinHeight && hasSkeletonLoading && hasStatsGrid) {
        console.log("🎉 Layout shift prevention: COMPLETE");
      } else {
        console.log("⚠️  Layout shift prevention: NEEDS WORK");
      }
    } else {
      console.log(`❌ File not found: ${file}`);
    }
  });
}

function runT040Compliance() {
  console.log("🚀 T-040 MOBILE PERFORMANCE COMPLIANCE CHECK");
  console.log("============================================");

  let passedChecks = 0;
  const totalChecks = Object.keys(T040_REQUIREMENTS).length;

  Object.entries(T040_REQUIREMENTS).forEach(([name, requirement]) => {
    const passed = requirement.check();
    const status = passed ? "✅" : "❌";

    console.log(`${status} ${name}`);
    console.log(`   ${requirement.description}`);

    if (passed) passedChecks++;
  });

  console.log(`\n📊 COMPLIANCE SUMMARY`);
  console.log("====================");
  console.log(`Passed: ${passedChecks}/${totalChecks} checks`);

  const compliancePercent = Math.round((passedChecks / totalChecks) * 100);
  console.log(`Compliance: ${compliancePercent}%`);

  if (compliancePercent === 100) {
    console.log("🎉 T-040 FULLY COMPLIANT!");
  } else if (compliancePercent >= 80) {
    console.log("✅ T-040 MOSTLY COMPLIANT - Minor issues remain");
  } else {
    console.log("⚠️  T-040 NEEDS WORK - Major issues to address");
  }

  // Detailed analysis
  analyzeImageOptimization();
  checkLayoutShiftPrevention();

  // Performance recommendations
  console.log("\n🛠️  PERFORMANCE RECOMMENDATIONS");
  console.log("===============================");

  if (passedChecks < totalChecks) {
    console.log("Priority fixes:");
    Object.entries(T040_REQUIREMENTS).forEach(([name, requirement]) => {
      if (!requirement.check()) {
        console.log(`• Fix: ${name}`);
      }
    });
  }

  console.log("\nNext steps:");
  console.log("• Run real device testing");
  console.log("• Monitor Core Web Vitals in production");
  console.log("• Set up Lighthouse CI for continuous monitoring");

  return {
    passed: passedChecks,
    total: totalChecks,
    compliance: compliancePercent,
    fullyCompliant: compliancePercent === 100,
  };
}

function main() {
  const results = runT040Compliance();

  // Exit with appropriate code
  process.exit(results.fullyCompliant ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { runT040Compliance, T040_REQUIREMENTS };
