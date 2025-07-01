#!/usr/bin/env node

/**
 * Accessibility Testing Script for T-041
 *
 * This script performs basic accessibility checks on the AI Power Rankings site
 * to validate the fixes implemented for T-041.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const puppeteer = require("puppeteer");

async function runAccessibilityTests() {
  console.log("🔍 Starting accessibility tests for T-041...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Test the home page
    console.log("Testing home page accessibility...");
    await page.goto("http://localhost:3000/en", { waitUntil: "networkidle0" });

    // Inject axe-core
    await page.addScriptTag({ path: require.resolve("axe-core") });

    // Run axe accessibility tests
    const results = await page.evaluate(() => {
      return axe.run();
    });

    // Check for violations
    if (results.violations.length === 0) {
      console.log("✅ No accessibility violations found on home page!");
    } else {
      console.log(`❌ Found ${results.violations.length} accessibility violations:`);
      results.violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. ${violation.id}: ${violation.description}`);
        console.log(`   Impact: ${violation.impact}`);
        console.log(`   Help: ${violation.helpUrl}`);
        violation.nodes.forEach((node, nodeIndex) => {
          console.log(`   Element ${nodeIndex + 1}: ${node.target.join(", ")}`);
        });
      });
    }

    // Test keyboard navigation
    console.log("\n🎹 Testing keyboard navigation...");
    await testKeyboardNavigation(page);

    // Test focus management
    console.log("\n🎯 Testing focus management...");
    await testFocusManagement(page);

    // Test heading hierarchy
    console.log("\n📝 Testing heading hierarchy...");
    await testHeadingHierarchy(page);

    // Test ARIA attributes
    console.log("\n🏷️  Testing ARIA attributes...");
    await testAriaAttributes(page);
  } catch (error) {
    console.error("Error running accessibility tests:", error);
  } finally {
    await browser.close();
  }
}

async function testKeyboardNavigation(page) {
  // Test tab navigation
  const focusableElements = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return elements.length;
  });

  console.log(`   Found ${focusableElements} focusable elements`);

  // Test skip link
  await page.keyboard.press("Tab");
  const skipLinkVisible = await page.evaluate(() => {
    const skipLink = document.querySelector('a[href="#main-content"]');
    return skipLink && window.getComputedStyle(skipLink).position !== "absolute";
  });

  if (skipLinkVisible) {
    console.log("   ✅ Skip to content link is visible on focus");
  } else {
    console.log("   ❌ Skip to content link not found or not visible");
  }
}

async function testFocusManagement(page) {
  // Test focus indicators
  const focusIndicators = await page.evaluate(() => {
    const styles = window.getComputedStyle(document.documentElement);
    return {
      ringColor: styles.getPropertyValue("--ring"),
      ringOffset: styles.getPropertyValue("--ring-offset"),
    };
  });

  if (focusIndicators.ringColor) {
    console.log("   ✅ Focus ring color defined in CSS variables");
  } else {
    console.log("   ❌ Focus ring color not found in CSS variables");
  }
}

async function testHeadingHierarchy(page) {
  const headings = await page.evaluate(() => {
    const headingElements = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    return Array.from(headingElements).map((h) => ({
      level: parseInt(h.tagName.substring(1)),
      text: h.textContent?.trim().substring(0, 50) + "...",
    }));
  });

  console.log("   Heading structure:");
  let previousLevel = 0;
  let hasErrors = false;

  headings.forEach((heading) => {
    const levelDiff = heading.level - previousLevel;
    const status = levelDiff > 1 ? "❌" : "✅";

    if (levelDiff > 1 && previousLevel > 0) {
      hasErrors = true;
    }

    console.log(`   ${status} H${heading.level}: ${heading.text}`);
    previousLevel = heading.level;
  });

  if (!hasErrors) {
    console.log("   ✅ Heading hierarchy is sequential");
  } else {
    console.log("   ❌ Heading hierarchy has skipped levels");
  }
}

async function testAriaAttributes(page) {
  const ariaIssues = await page.evaluate(() => {
    const issues = [];

    // Check for buttons without accessible names
    const buttons = document.querySelectorAll("button");
    buttons.forEach((button, index) => {
      const hasText = button.textContent?.trim();
      const hasAriaLabel = button.getAttribute("aria-label");
      const hasAriaLabelledby = button.getAttribute("aria-labelledby");

      if (!hasText && !hasAriaLabel && !hasAriaLabelledby) {
        issues.push(`Button ${index + 1} has no accessible name`);
      }
    });

    // Check for proper landmark roles
    const main = document.querySelector("main");
    const nav = document.querySelector("nav");
    const footer = document.querySelector("footer");

    if (!main) issues.push("No main landmark found");
    if (!nav) issues.push("No navigation landmark found");
    if (!footer) issues.push("No footer landmark found");

    return issues;
  });

  if (ariaIssues.length === 0) {
    console.log("   ✅ No ARIA issues found");
  } else {
    console.log("   ❌ ARIA issues found:");
    ariaIssues.forEach((issue) => {
      console.log(`     - ${issue}`);
    });
  }
}

// Run the tests
if (require.main === module) {
  runAccessibilityTests().catch(console.error);
}

module.exports = { runAccessibilityTests };
