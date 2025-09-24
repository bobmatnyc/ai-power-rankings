#!/usr/bin/env tsx

/**
 * Script to test if the middleware compiles and exports correctly
 */

import { NextRequest, NextResponse } from "next/server";

async function testMiddleware() {
  console.log("Testing middleware compilation and exports...");

  try {
    // Import the middleware
    const middlewareModule = await import("../src/middleware");

    console.log("✅ Middleware module loaded successfully");
    console.log("✅ Default export:", typeof middlewareModule.default);
    console.log("✅ Config export:", typeof middlewareModule.config);

    if (typeof middlewareModule.default !== "function") {
      throw new Error("Middleware default export is not a function");
    }

    if (typeof middlewareModule.config !== "object") {
      throw new Error("Middleware config export is not an object");
    }

    console.log("\n✅ All middleware exports are valid!");
    console.log("\nMiddleware configuration:");
    console.log("- Matcher patterns:", middlewareModule.config.matcher);

    process.exit(0);
  } catch (error) {
    console.error("❌ Middleware test failed:", error);
    process.exit(1);
  }
}

testMiddleware();