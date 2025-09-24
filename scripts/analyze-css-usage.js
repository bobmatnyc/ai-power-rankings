#!/usr/bin/env node

/**
 * CSS Usage Analysis Script
 *
 * WHY: Analyzes which CSS classes are actually used in the codebase
 * to help optimize Tailwind purging and reduce CSS bundle size.
 *
 * DESIGN DECISION: Scans source files to identify real usage patterns
 * and suggests optimization strategies.
 */

const fs = require("node:fs");
const { glob } = require("glob");

// Source directories to scan
const SOURCE_DIRS = [
  "src/**/*.{js,jsx,ts,tsx}",
  "pages/**/*.{js,jsx,ts,tsx}",
  "components/**/*.{js,jsx,ts,tsx}",
  "app/**/*.{js,jsx,ts,tsx}",
];

// Pattern to match class names
const CLASS_PATTERN = /className\s*[=:]\s*[`"']([^`"']*)[`"']/g;

async function analyzeUsage() {
  console.log("🔍 Analyzing CSS class usage in codebase...\n");

  const classUsage = new Map();
  const filePatterns = new Set();

  // Get all source files
  const sourceFiles = await glob(SOURCE_DIRS, { ignore: "node_modules/**" });

  console.log(`📂 Scanning ${sourceFiles.length} files...\n`);

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    const classes = extractClasses(content);

    if (classes.length > 0) {
      console.log(`📄 ${file}:`);
      for (const className of classes) {
        // Count usage
        const count = classUsage.get(className) || 0;
        classUsage.set(className, count + 1);

        // Track patterns
        trackPatterns(className, filePatterns);
      }
      console.log(`   ${classes.length} classes found`);
    }
  }

  // Analyze results
  console.log("\n📊 Usage Analysis:\n");

  const sortedClasses = Array.from(classUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50); // Top 50 most used classes

  console.log("🔥 Most frequently used classes:");
  sortedClasses.forEach(([className, count], index) => {
    console.log(`${(index + 1).toString().padStart(2)}: ${className.padEnd(30)} (${count} times)`);
  });

  console.log("\n🎯 Identified patterns:");
  Array.from(filePatterns)
    .sort()
    .forEach((pattern) => {
      console.log(`   ${pattern}`);
    });

  // Analyze by category
  const categories = categorizeClasses(Array.from(classUsage.keys()));
  console.log("\n📋 Classes by category:");
  Object.entries(categories).forEach(([category, classes]) => {
    console.log(`   ${category}: ${classes.length} classes`);
  });

  // Generate recommendations
  generateRecommendations(classUsage, categories);
}

function extractClasses(content) {
  const classes = new Set();

  // Match regular className patterns
  let match = CLASS_PATTERN.exec(content);
  while (match !== null) {
    const classString = match[1];
    // Split by spaces and filter out template literals
    classString.split(/\s+/).forEach((cls) => {
      if (cls && !cls.includes("${") && !cls.includes("{") && cls.length > 0) {
        classes.add(cls.trim());
      }
    });
    match = CLASS_PATTERN.exec(content);
  }

  // Reset regex
  CLASS_PATTERN.lastIndex = 0;

  return Array.from(classes);
}

function trackPatterns(className, patterns) {
  // Track responsive patterns
  if (/^(sm|md|lg|xl|2xl):/.test(className)) {
    patterns.add(`Responsive: ${className.split(":")[0]}`);
  }

  // Track state patterns
  if (/^(hover|focus|active|disabled):/.test(className)) {
    patterns.add(`State: ${className.split(":")[0]}`);
  }

  // Track color patterns
  if (/-(red|blue|green|gray|purple|yellow|pink|indigo)-\d+$/.test(className)) {
    const colorMatch = className.match(/-(red|blue|green|gray|purple|yellow|pink|indigo)-(\d+)$/);
    if (colorMatch) {
      patterns.add(`Color: ${colorMatch[1]}-${colorMatch[2]}`);
    }
  }

  // Track spacing patterns
  if (/^[mp][xytrbl]?-\d+$/.test(className)) {
    patterns.add(`Spacing: ${className}`);
  }
}

function categorizeClasses(classes) {
  const categories = {
    layout: [],
    spacing: [],
    typography: [],
    colors: [],
    responsive: [],
    states: [],
    animation: [],
    borders: [],
    other: [],
  };

  classes.forEach((cls) => {
    if (/^(flex|grid|block|inline|hidden|container)/.test(cls)) {
      categories.layout.push(cls);
    } else if (/^[mp][xytrbl]?-/.test(cls)) {
      categories.spacing.push(cls);
    } else if (/^(text-|font-|leading-|tracking-)/.test(cls)) {
      categories.typography.push(cls);
    } else if (
      /(bg-|text-|border-|ring-).*-(red|blue|green|gray|purple|yellow|pink|indigo|white|black)/.test(
        cls
      )
    ) {
      categories.colors.push(cls);
    } else if (/^(sm|md|lg|xl|2xl):/.test(cls)) {
      categories.responsive.push(cls);
    } else if (/^(hover|focus|active|disabled):/.test(cls)) {
      categories.states.push(cls);
    } else if (/^(animate-|transition-|duration-)/.test(cls)) {
      categories.animation.push(cls);
    } else if (/^(border|rounded)/.test(cls)) {
      categories.borders.push(cls);
    } else {
      categories.other.push(cls);
    }
  });

  return categories;
}

function generateRecommendations(classUsage, categories) {
  console.log("\n💡 Optimization Recommendations:\n");

  const totalClasses = classUsage.size;
  const highUsageClasses = Array.from(classUsage.entries()).filter(
    ([, count]) => count >= 5
  ).length;

  console.log(`✅ Keep ${highUsageClasses} frequently used classes (used 5+ times)`);
  console.log(`⚠️  Consider purging ${totalClasses - highUsageClasses} rarely used classes`);

  // Typography plugin analysis
  const proseClasses = Array.from(classUsage.keys()).filter((cls) => cls.startsWith("prose"));
  if (proseClasses.length === 0) {
    console.log("🚨 No prose classes found - consider removing @tailwindcss/typography plugin");
  } else {
    console.log(
      `📖 Found ${proseClasses.length} typography classes - keep @tailwindcss/typography`
    );
  }

  // Animation plugin analysis
  const animateClasses = categories.animation.length;
  if (animateClasses === 0) {
    console.log("🚨 No animation classes found - consider removing tailwindcss-animate plugin");
  } else {
    console.log(`🎬 Found ${animateClasses} animation classes - keep tailwindcss-animate`);
  }

  console.log("\n🎯 Tailwind Safelist Suggestions:");

  // Suggest safelist based on actual usage
  const criticalClasses = Array.from(classUsage.entries())
    .filter(([, count]) => count >= 3)
    .map(([cls]) => cls)
    .slice(0, 30);

  console.log("Add these critical classes to safelist:");
  criticalClasses.forEach((cls) => {
    console.log(`  '${cls}',`);
  });
}

// Run the analysis
analyzeUsage().catch(console.error);
