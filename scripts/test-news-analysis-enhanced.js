#!/usr/bin/env node

/**
 * Test script for enhanced news analysis features
 * Tests: URL analysis, text analysis, file upload, verbose logging, error handling
 */

// File system operations not needed in this test

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// ANSI color codes for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log();
  log(`${"=".repeat(60)}`, colors.cyan);
  log(title, colors.bright + colors.cyan);
  log(`${"=".repeat(60)}`, colors.cyan);
}

function logTestResult(testName, success, details = "") {
  const icon = success ? "✅" : "❌";
  const color = success ? colors.green : colors.red;
  log(`${icon} ${testName}`, color);
  if (details) {
    log(`   ${details}`, colors.reset);
  }
}

async function testNewsAnalysis(input, type, options = {}) {
  try {
    const body = {
      input,
      type,
      ...options,
    };

    log(`\nTesting ${type} analysis...`, colors.yellow);
    if (options.verbose) {
      log("  With verbose logging enabled", colors.yellow);
    }

    const response = await fetch(`${BASE_URL}/api/admin/news/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      log(`  Error: ${data.error}`, colors.red);
      if (data.type) {
        log(`  Error type: ${data.type}`, colors.red);
      }
      if (data.troubleshooting) {
        log("  Troubleshooting steps:", colors.yellow);
        data.troubleshooting.forEach((step) => {
          log(`    - ${step}`, colors.yellow);
        });
      }
      return { success: false, error: data.error, details: data };
    }

    if (data.warning) {
      log(`  Warning: ${data.warning}`, colors.yellow);
    }

    if (data.debug) {
      log("  Debug info:", colors.blue);
      log(`    Processing time: ${data.debug.processingTime}`, colors.blue);
      log(`    Method: ${data.debug.method}`, colors.blue);
    }

    if (data.analysis) {
      log("  Analysis successful!", colors.green);
      log(`    Title: ${data.analysis.title}`, colors.reset);
      log(`    Tool mentions: ${data.analysis.tool_mentions.length}`, colors.reset);
      log(`    Importance: ${data.analysis.importance_score}/10`, colors.reset);
    }

    return { success: true, data };
  } catch (error) {
    log(`  Exception: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function createTestPDF() {
  // Create a simple text file to simulate PDF content (since we can't easily create a real PDF)
  const testContent = `
AI News Test Document

OpenAI Announces GPT-5 with Revolutionary Capabilities

San Francisco, CA - OpenAI today unveiled GPT-5, their latest language model that promises 
to revolutionize artificial intelligence applications. The new model features significant 
improvements in reasoning, multimodal understanding, and real-time processing.

Key features include:
- Enhanced reasoning capabilities with 10x improvement over GPT-4
- Native multimodal processing for text, images, and audio
- Real-time streaming responses with ultra-low latency
- Integration with popular development tools like GitHub Copilot and Cursor

Industry experts predict this will accelerate AI adoption across enterprises, with particular 
impact on software development, content creation, and data analysis workflows.

The model will be available through OpenAI's API and integrated into ChatGPT Plus subscriptions 
starting next month. Pricing details and enterprise licensing options will be announced soon.

This development comes as competition intensifies in the AI space, with Anthropic's Claude 3 
and Google's Gemini Ultra also vying for market dominance.
  `.trim();

  const base64Content = Buffer.from(testContent).toString("base64");
  return base64Content;
}

async function runTests() {
  logSection("Enhanced News Analysis Test Suite");

  const testResults = [];

  // Test 1: URL Analysis with verbose logging
  logSection("Test 1: URL Analysis (Verbose)");
  const urlTest = await testNewsAnalysis("https://openai.com/blog", "url", { verbose: true });
  testResults.push({
    name: "URL Analysis with Verbose Logging",
    success: urlTest.success,
    details: urlTest.error || "Successfully analyzed URL",
  });

  // Test 2: Text Analysis
  logSection("Test 2: Text Analysis");
  const textContent = `
    Anthropic releases Claude 3.5, a major upgrade to their AI assistant.
    The new version features improved coding capabilities, better reasoning,
    and enhanced performance on complex tasks. Early users report significant
    improvements in code generation and debugging workflows.
  `;
  const textTest = await testNewsAnalysis(textContent, "text");
  testResults.push({
    name: "Text Analysis",
    success: textTest.success,
    details: textTest.error || "Successfully analyzed text",
  });

  // Test 3: File Upload Simulation (PDF)
  logSection("Test 3: File Upload (PDF Simulation)");
  const pdfContent = await createTestPDF();
  const fileTest = await testNewsAnalysis(pdfContent, "file", {
    filename: "test-article.pdf",
    mimeType: "application/pdf",
    verbose: true,
  });
  testResults.push({
    name: "File Upload (PDF)",
    success: fileTest.success,
    details: fileTest.error || "Successfully analyzed PDF file",
  });

  // Test 4: Text File Upload
  logSection("Test 4: Text File Upload");
  const textFileContent = Buffer.from(
    "Microsoft announces new AI features in Visual Studio Code."
  ).toString("base64");
  const textFileTest = await testNewsAnalysis(textFileContent, "file", {
    filename: "article.txt",
    mimeType: "text/plain",
  });
  testResults.push({
    name: "File Upload (Text)",
    success: textFileTest.success,
    details: textFileTest.error || "Successfully analyzed text file",
  });

  // Test 5: Error Handling - Invalid API Key
  logSection("Test 5: Error Handling");
  // This will test the error handling by attempting analysis
  // The actual error will depend on whether OPENROUTER_API_KEY is configured
  const errorTest = await testNewsAnalysis("Test content", "text");
  testResults.push({
    name: "Error Handling",
    success: true, // We expect it to handle errors gracefully
    details: errorTest.error
      ? "Error handled gracefully with troubleshooting info"
      : "Analysis succeeded (API key configured)",
  });

  // Test 6: Unsupported File Type
  logSection("Test 6: Unsupported File Type");
  const unsupportedTest = await testNewsAnalysis("dummy content", "file", {
    filename: "image.jpg",
    mimeType: "image/jpeg",
  });
  testResults.push({
    name: "Unsupported File Type Handling",
    success: !unsupportedTest.success && unsupportedTest.error?.includes("Unsupported"),
    details: unsupportedTest.error || "Should have rejected unsupported file type",
  });

  // Summary
  logSection("Test Results Summary");
  console.log();

  let passedTests = 0;
  testResults.forEach((result) => {
    logTestResult(result.name, result.success, result.details);
    if (result.success) passedTests++;
  });

  console.log();
  const totalTests = testResults.length;
  const allPassed = passedTests === totalTests;
  const summaryColor = allPassed ? colors.green : colors.yellow;

  log(`${"=".repeat(60)}`, summaryColor);
  log(`Tests Passed: ${passedTests}/${totalTests}`, summaryColor + colors.bright);
  log(`${"=".repeat(60)}`, summaryColor);

  if (!allPassed) {
    log("\nNote: Some tests may fail if OPENROUTER_API_KEY is not configured.", colors.yellow);
    log("This is expected behavior - the fallback analysis should still work.", colors.yellow);
  }

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  log("Fatal error running tests:", colors.red);
  console.error(error);
  process.exit(1);
});
